/* Sends masked posts and photos automatically after connection, unless disabled in Settings. */
(function (global) {
  "use strict";

  const DEFAULT_API_URL = "https://trocheck-api.onrender.com/api/v1";
  const BATCH_SIZE = 20;
  const STATUS_MESSAGES = {
    401: "Mã kết nối sai, đã bị thu hồi hoặc hết hạn. Kết nối lại trong trang Tài khoản.",
    403: "Tài khoản chưa có quyền thu dữ liệu (collector). Liên hệ quản trị viên để cấp quyền rồi kết nối lại.",
    429: "Máy chủ đang giới hạn số bài nhận mỗi phút.",
  };

  /** Only addresses covered by host_permissions in manifest.json. */
  function normalizeApiUrl(value) {
    const url = new URL(String(value).trim() || DEFAULT_API_URL);
    const hosted = url.protocol === "https:" && url.hostname === "trocheck-api.onrender.com";
    const local = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
    if (!hosted && !local) throw new Error("Địa chỉ API không được phép.");
    return url.href.replace(/\/+$/u, "");
  }

  function toIngestPost(record) {
    const postId = String(record.id).replace(/^facebook:/u, "");
    // Marketplace listings shared in a group keep their group in group_id, not in the URL.
    const groupId = record.group_id ?? String(record.postUrl).match(/\/groups\/([^/]+)\//u)?.[1];
    const groupName = String(record.raw_text ?? "").match(/^Group: (.+)\n\n/u)?.[1];
    return {
      idempotency_key: `fb:${groupId ?? "page"}:${postId}`,
      source_type: "facebook_group",
      permalink: record.postUrl,
      external_post_id: postId,
      ...(groupId ? { source_group_id: groupId.slice(0, 100) } : {}),
      ...(groupName ? { source_group_name: groupName.slice(0, 300) } : {}),
      text: global.TroPrivacy.maskPhones(record.text).slice(0, 20000),
      text_complete: record.text_status === "expanded",
      phone_masked: true,
    };
  }

  async function call({ apiUrl, token, path, method = "GET", body, fetcher = global.fetch.bind(global) }) {
    if (!String(token ?? "").trim()) throw new Error("Chưa kết nối. Mở trang Tài khoản để kết nối extension.");
    let response;
    try {
      response = await fetcher(`${normalizeApiUrl(apiUrl)}${path}`, {
        method,
        credentials: "omit",
        ...(global.AbortSignal?.timeout ? { signal: global.AbortSignal.timeout(25000) } : {}),
        headers: { Authorization: `Bearer ${token.trim()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new Error("Không kết nối được máy chủ TrọCheck.");
    }
    if (!response.ok) {
      const error = new Error(STATUS_MESSAGES[response.status] ?? `Máy chủ TrọCheck báo lỗi (HTTP ${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  const whoAmI = options => call({ ...options, path: "/auth/me" });

  /** Sends each saved room photo once. Files the store will never take are marked so they are not retried. */
  async function sendImages({ storage, apiUrl, token, fetcher = global.fetch.bind(global), onProgress }) {
    const pending = storage.readImagesToUpload ? await storage.readImagesToUpload() : [];
    const totals = { uploaded: 0, duplicate: 0, skipped: 0, total: pending.length };
    if (!pending.length) return totals;
    if (!String(token ?? "").trim()) throw new Error("Chưa có token. Nhập token trong phần Cài đặt.");
    const base = normalizeApiUrl(apiUrl);
    for (const { image, record } of pending) {
      const key = toIngestPost(record).idempotency_key;
      let response;
      try {
        response = await fetcher(`${base}/ingest/images?idempotency_key=${encodeURIComponent(key)}`, {
          method: "PUT", credentials: "omit",
          ...(global.AbortSignal?.timeout ? { signal: global.AbortSignal.timeout(25000) } : {}),
          headers: { Authorization: `Bearer ${token.trim()}`, "Content-Type": image.data.type || "application/octet-stream" },
          body: image.data,
        });
      } catch {
        throw new Error("Không kết nối được máy chủ TrọCheck khi gửi ảnh.");
      }
      if (response.ok) {
        const { status } = await response.json();
        totals[status === "duplicate" ? "duplicate" : "uploaded"] += 1;
        await storage.markImageUploaded(image.id, status);
      } else if ([409, 413, 415].includes(response.status)) {
        totals.skipped += 1;
        await storage.markImageUploaded(image.id, "skipped");
      } else if (response.status >= 500 || STATUS_MESSAGES[response.status]) {
        const error = new Error(STATUS_MESSAGES[response.status] ?? (response.status === 503
          ? "Máy chủ TrọCheck chưa bật lưu ảnh. Bài đã gửi, ảnh sẽ gửi ở lần sau."
          : `Không gửi được ảnh (HTTP ${response.status}). Ảnh được giữ lại để gửi sau.`));
        error.status = response.status;
        throw error;
      } else {
        totals.skipped += 1; // Leave unmarked so a later send can retry.
      }
      onProgress?.(totals);
    }
    return totals;
  }

  /** Sends every unsent post in batches and marks each one the server answered for. */
  async function sendUnsent({ storage, apiUrl, token, version, fetcher, onProgress }) {
    const unsent = (await storage.readUnsent()).filter(record => String(record.text ?? "").trim());
    const totals = { created: 0, duplicate: 0, rejected: 0 };
    const sessionId = `s-${new Date().toISOString().replace(/[^0-9]/gu, "").slice(0, 14)}`;
    for (let start = 0; start < unsent.length; start += BATCH_SIZE) {
      const records = unsent.slice(start, start + BATCH_SIZE);
      const posts = records.map(toIngestPost);
      const answer = await call({ apiUrl, token, fetcher, path: "/ingest/batch", method: "POST",
        body: { client: { extension_version: version, session_id: sessionId }, posts } });
      const byKey = new Map(answer.results.map(result => [result.idempotency_key, result.status]));
      await storage.markSent(records.flatMap((record, index) => {
        const status = byKey.get(posts[index].idempotency_key);
        return status ? [{ id: record.id, status }] : [];
      }));
      for (const key of Object.keys(totals)) totals[key] += answer.summary?.[key] ?? 0;
      onProgress?.({ ...totals, total: unsent.length });
    }
    const images = await sendImages({ storage, apiUrl, token, fetcher });
    return { ...totals, total: unsent.length, images };
  }

  global.TroCheck = { DEFAULT_API_URL, BATCH_SIZE, normalizeApiUrl, toIngestPost, whoAmI, sendUnsent, sendImages };
})(globalThis);

"use strict";
importScripts("trocheck.js");

const SEND_ALARM = "send-to-trocheck";
const WEB_APIS = {
  "https://trocheck.vercel.app": "https://trocheck-api.onrender.com/api/v1",
  "http://localhost:3000": "http://127.0.0.1:8000/api/v1",
  "http://127.0.0.1:3000": "http://127.0.0.1:8000/api/v1",
};
let sending = null;
const tabCounts = new Map();
let countUpdate = Promise.resolve();
const supportedUrl = value => {
  try { const url = new URL(value); return url.origin === "https://www.facebook.com" && /^\/(?:groups|search)\//u.test(url.pathname); }
  catch { return false; }
};
const settings = () => chrome.storage?.local?.get(["trocheckToken", "trocheckApiUrl", "trocheckAccount", "trocheckAutoSend", "trocheckSync"]) ?? Promise.resolve({});
const saveSettings = data => chrome.storage.local.set(data);

function tabCount(tabId, increment = 0) {
  const result = countUpdate.then(async () => {
    const key = `saved:${tabId}`;
    const stored = await chrome.storage?.session?.get(key);
    const count = (stored?.[key] ?? tabCounts.get(tabId) ?? 0) + increment;
    tabCounts.set(tabId, count);
    if (increment) await chrome.storage?.session?.set({ [key]: count });
    return count;
  });
  countUpdate = result.catch(() => {});
  return result;
}

async function updateBadge(tabId, url) {
  if (!chrome.action || tabId == null) return;
  const config = await settings();
  const warning = !config.trocheckToken || config.trocheckSync?.blocked;
  const text = supportedUrl(url) ? (warning ? "!" : String(await tabCount(tabId))) : "";
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setTitle({ tabId, title: warning && supportedUrl(url)
    ? (config.trocheckSync?.error || "Chưa kết nối. Mở TrọCheck để kết nối tài khoản.") : "TrọCheck Collector" });
}

/** Why saved posts are not reaching the store, or an empty string when they are. */
async function sendNote() {
  const config = await settings();
  if (!config.trocheckToken) return "Chưa kết nối tài khoản nên bài chỉ lưu trên máy. Bấm biểu tượng TrọCheck để kết nối.";
  const sync = config.trocheckSync;
  return sync?.blocked || (sync?.daily && sync.nextAttempt > Date.now()) ? sync.error : "";
}

async function refreshBadges() {
  const tabs = await chrome.tabs?.query({ url: "https://www.facebook.com/*" }) ?? [];
  await Promise.all(tabs.map(tab => updateBadge(tab.id, tab.url)));
}

async function scheduleSend() {
  const config = await settings();
  if (!config.trocheckToken || config.trocheckAutoSend === false || config.trocheckSync?.blocked) return;
  const when = Math.max(Date.now() + 5000, config.trocheckSync?.nextAttempt || 0);
  // Keep the first scheduled batch so continuous scrolling cannot postpone sending forever.
  const existing = await chrome.alarms?.get?.(SEND_ALARM);
  if (!existing || existing.scheduledTime > when || existing.scheduledTime < (config.trocheckSync?.nextAttempt || 0)) {
    await chrome.alarms?.create(SEND_ALARM, { when });
  }
}

function sendStored(manual = false) {
  if (sending) return sending.then(answer => manual && (answer.paused || answer.empty) ? sendStored(true) : answer);
  sending = (async () => {
    const config = await settings();
    if (!config.trocheckToken) return { ok: false, error: "Chưa kết nối. Mở trang Tài khoản để kết nối extension." };
    if (!manual && (config.trocheckAutoSend === false || config.trocheckSync?.blocked || config.trocheckSync?.nextAttempt > Date.now())) return { ok: true, paused: true };
    if (!manual && !(await TroStorage.readUnsent()).length && !(await TroStorage.readImagesToUpload()).length) return { ok: true, empty: true };
    // Persist a recovery alarm before fetching, in case the worker is suspended.
    if (config.trocheckAutoSend !== false) await chrome.alarms?.create(SEND_ALARM, { when: Date.now() + 120000 });
    try {
      const result = await TroCheck.sendUnsent({ storage: TroStorage, apiUrl: config.trocheckApiUrl || "", token: config.trocheckToken,
        version: chrome.runtime.getManifest().version });
      if ((await settings()).trocheckToken === config.trocheckToken) {
        await saveSettings({ trocheckSync: { lastResult: `Lần gửi gần nhất: ${result.total} bài, ${result.images.uploaded} ảnh mới${result.rejected ? `, ${result.rejected} bài bị từ chối` : ""}.`, lastSent: Date.now() } });
      }
      return { ok: true, result };
    } catch (error) {
      const blocked = [401, 403].includes(error.status);
      // The store takes a fixed number of posts per minute, so 429 is a pause, not a failure to back off from.
      const limited = error.status === 429;
      // A daily cap says how long until the store takes posts again: wait for that, not for a minute.
      const daily = limited && Boolean(error.retryAfter);
      const attempts = (config.trocheckSync?.attempts || 0) + (limited ? 0 : 1);
      const delay = daily ? Math.min(error.retryAfter * 1000 + 60000, 25 * 60 * 60 * 1000)
        : limited ? 70000 : Math.min(60 * 60 * 1000, 60000 * 2 ** Math.min(attempts - 1, 6));
      const nextAttempt = Date.now() + delay;
      const reason = blocked ? error.message
        : daily ? `${error.message} Phần còn lại vẫn ở trên máy và sẽ tự gửi tiếp sau 0 giờ.`
        : limited ? `${error.message} Phần còn lại vẫn ở trên máy và sẽ tự gửi tiếp sau khoảng một phút.`
          : `${error.message} Dữ liệu vẫn ở trên máy; sẽ tự gửi lại sau ${Math.ceil(delay / 60000)} phút.`;
      if ((await settings()).trocheckToken === config.trocheckToken) {
        await saveSettings({ trocheckSync: { blocked, daily, error: reason, attempts, nextAttempt: blocked ? 0 : nextAttempt } });
        if (blocked) await chrome.alarms?.clear?.(SEND_ALARM);
        else if (config.trocheckAutoSend !== false) await chrome.alarms?.create(SEND_ALARM, { when: nextAttempt });
      }
      return { ok: false, error: reason };
    } finally { await refreshBadges(); }
  })().finally(() => { sending = null; });
  return sending;
}

async function connectToken(apiUrl, token) {
  if (typeof token !== "string" || !token.trim()) throw new Error("Mã kết nối trống. Tạo kết nối mới trong trang Tài khoản.");
  let user;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { user = await TroCheck.whoAmI({ apiUrl, token }); break; }
    catch (error) {
      if (attempt === 2 || (error.status && error.status < 500)) throw error;
      // A sleeping API may need two bounded requests before it can answer.
      await settings();
    }
  }
  if (typeof user?.username !== "string" || !user.username.trim()) throw new Error("API không trả về tên tài khoản. Kiểm tra địa chỉ API rồi kết nối lại.");
  await saveSettings({ trocheckApiUrl: apiUrl, trocheckToken: token.trim(), trocheckAccount: user.username,
    trocheckAutoSend: true, trocheckSync: {} });
  await scheduleSend();
  await refreshBadges();
  return { ok: true, account: user.username };
}

function controlMessage(message, sender, sendResponse) {
  const internal = sender.url?.startsWith(chrome.runtime.getURL?.(""));
  const types = ["CONNECT_WEB", "CONNECT_MANUAL", "DISCONNECT", "AUTO_SEND", "SEND_NOW", "GET_STATUS", "COLLECTOR_STATUS"];
  if (!types.includes(message?.type)) return;
  (async () => {
    if (message.type === "CONNECT_WEB") {
      const origin = new URL(sender.url).origin;
      if (!sender.tab || !Object.hasOwn(WEB_APIS, origin) || message.origin !== origin) throw new Error("Trang kết nối không được phép.");
      return connectToken(WEB_APIS[origin], message.token);
    }
    if (message.type === "COLLECTOR_STATUS") {
      if (!sender.tab || new URL(sender.url).origin !== "https://www.facebook.com") return { ok: false };
      await updateBadge(sender.tab.id, message.pageUrl);
      return { ok: true, saved: await tabCount(sender.tab.id), note: await sendNote() };
    }
    if (!internal) throw new Error("Yêu cầu phải đến từ giao diện extension.");
    if (message.type === "CONNECT_MANUAL") return connectToken(TroCheck.normalizeApiUrl(message.apiUrl), message.token);
    if (message.type === "DISCONNECT") {
      await chrome.storage.local.remove(["trocheckToken", "trocheckAccount", "trocheckSync"]);
      await chrome.alarms?.clear?.(SEND_ALARM);
      await refreshBadges();
      return { ok: true };
    }
    if (message.type === "AUTO_SEND") {
      await saveSettings({ trocheckAutoSend: message.enabled === true });
      if (message.enabled) await scheduleSend();
      else await chrome.alarms?.clear?.(SEND_ALARM);
      return { ok: true };
    }
    if (message.type === "SEND_NOW") return sendStored(true);
    const config = await settings();
    const [unsent, page] = await Promise.all([TroStorage.readUnsent(), TroStorage.readPage()]);
    return { ok: true, connected: !!config.trocheckToken, account: config.trocheckAccount,
      autoSend: config.trocheckAutoSend !== false, sync: config.trocheckSync,
      saved: await tabCount(message.tabId), waiting: unsent.length, sent: page.total - unsent.length };
  })().then(sendResponse, error => sendResponse({ ok: false, error: error.message }));
  return true;
}

chrome.tabs?.onUpdated?.addListener((tabId, change, tab) => {
  if (change.url || change.status === "loading") updateBadge(tabId, tab.url).catch(() => {});
});
chrome.tabs?.onRemoved?.addListener(tabId => {
  tabCounts.delete(tabId);
  chrome.storage?.session?.remove(`saved:${tabId}`);
});

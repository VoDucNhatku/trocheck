/* Observe only supported routes, including Facebook client-side navigation. */
(function () {
  "use strict";
  globalThis.troCollector?.stop();
  const records = new Map();
  let collector = null;
  let currentUrl = "";
  let saved = 0;
  let fresh = 0;
  let note = "";
  let chip = null;
  let label = null;
  let dismissed = false;
  try { dismissed = sessionStorage.getItem("trocheck-dismissed") === "true"; } catch { /* Storage can be restricted. */ }
  const supported = () => location.origin === "https://www.facebook.com" && /^\/(?:groups|search)\//u.test(location.pathname);

  function render(error) {
    if (!supported() || dismissed) { chip?.remove(); chip = null; return; }
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "trocheck-status";
      chip.style.cssText = "position:fixed;bottom:16px;left:16px;z-index:2147483647;max-width:min(300px,70vw)";
      const root = chip.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = ":host{color-scheme:light dark}div{display:flex;gap:8px;align-items:center;padding:8px 10px;border:1px solid GrayText;border-radius:8px;background:Canvas;color:CanvasText;font:12px/1.5 system-ui}button{background:Canvas;color:CanvasText;border:0;cursor:pointer;font:16px system-ui}span{overflow-wrap:anywhere}";
      const box = document.createElement("div");
      label = document.createElement("span");
      label.setAttribute("role", "status");
      const close = document.createElement("button");
      close.textContent = "×";
      close.setAttribute("aria-label", "Ẩn trạng thái TrọCheck trong phiên này");
      close.onclick = () => {
        dismissed = true;
        try { sessionStorage.setItem("trocheck-dismissed", "true"); } catch { /* Keep the in-memory preference. */ }
        render();
      };
      box.append(label, close);
      root.append(style, box);
      document.documentElement.append(chip);
    }
    // Posts already stored earlier are not counted as new, so say so instead of showing a bare zero.
    const known = Math.max(0, records.size - fresh);
    label.textContent = error || `TrọCheck đang lưu · ${saved} bài mới${known ? ` · ${known} bài đã có` : ""}${note ? `. ${note}` : ""}`;
  }

  function navigate() {
    if (currentUrl === location.href) return;
    currentUrl = location.href;
    collector?.stop();
    collector = null;
    render();
    chrome.runtime.sendMessage({ type: "COLLECTOR_STATUS", pageUrl: currentUrl }).then(response => {
      if (Number.isFinite(response?.saved)) { saved = Math.max(saved, response.saved); note = response.note || ""; render(); }
    }).catch(() => {});
    if (!supported()) return;
    const observedUrl = currentUrl;
    collector = globalThis.TroCollector.observePosts({
      document,
      async onPosts(batch) {
        if (!supported() || location.href !== observedUrl) return;
        const masked = batch.filter(post => post.textStatus !== "partial").map(post => ({ ...post,
          text: TroPrivacy.maskPhones(post.text),
          ...(post.raw_text === undefined ? {} : { raw_text: TroPrivacy.maskPhones(post.raw_text) }) }));
        if (!masked.length) return;
        try {
          const response = await chrome.runtime.sendMessage({ type: "SAVE_RAW_POSTS", pageUrl: observedUrl, posts: masked });
          if (!response?.ok) throw new Error(response?.error || "Không lưu được bài trên máy. Mở bảng dữ liệu để kiểm tra dung lượng.");
          for (const post of masked) records.set(post.postUrl, post);
          saved += response.saved;
          fresh += response.saved;
          note = response.note ?? note;
          render();
          console.info("[TrọCheck Collector] Batch processed", response);
        } catch (error) { render(error.message); throw error; }
      },
    });
  }
  const timer = setInterval(navigate, 500);
  window.addEventListener("popstate", navigate);
  globalThis.troCollector = {
    stop() { collector?.stop(); clearInterval(timer); window.removeEventListener("popstate", navigate); chip?.remove(); },
    flush() { navigate(); return collector?.flush(); },
    snapshot: () => [...records.values()],
  };
  chrome.runtime.onMessage?.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || message?.type !== "GET_COLLECTED_POSTS") return;
    sendResponse({ posts: globalThis.troCollector.snapshot() });
  });
  navigate();
})();

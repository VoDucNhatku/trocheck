/* Bridges only the three trusted web origins to the extension worker. */
(function () {
  "use strict";
  const origins = ["https://trocheck.vercel.app", "http://localhost:3000", "http://127.0.0.1:3000"];
  if (!origins.includes(location.origin)) return;
  window.addEventListener("message", async event => {
    if (event.source !== window || event.origin !== location.origin || !origins.includes(event.origin)) return;
    const message = event.data;
    if (message?.source !== "trocheck-web" || typeof message.requestId !== "string") return;
    if (!["PING", "CONNECT"].includes(message.type)) return;
    let result = { ok: true };
    if (message.type === "CONNECT") {
      try {
        result = await chrome.runtime.sendMessage({ type: "CONNECT_WEB", token: message.token, origin: location.origin });
      } catch {
        result = { ok: false, error: "Extension đã ngừng hoạt động. Bật lại extension rồi kết nối lại." };
      }
    }
    window.postMessage({ source: "trocheck-extension", requestId: message.requestId, type: message.type === "PING" ? "PONG" : "CONNECTED", ...result }, location.origin);
  });
})();

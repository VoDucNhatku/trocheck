"use strict";

const status = document.querySelector("#status");
const download = document.querySelector("#download");

async function readPosts() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab.");
  const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_COLLECTED_POSTS" });
  if (!Array.isArray(response?.posts)) throw new Error("Collector is unavailable.");
  return response.posts;
}

function showError() {
  status.textContent = "Tab Facebook này chưa có bộ lưu bài. Sau khi vừa cài hoặc cập nhật extension, tải lại trang Facebook một lần.";
  download.disabled = true;
}

download.addEventListener("click", async () => {
  download.disabled = true;
  try {
    const posts = await readPosts();
    if (!posts.length) {
      status.textContent = "Chưa có bài nào. Cuộn Facebook rồi mở lại cửa sổ này.";
      return;
    }
    const blob = new Blob([JSON.stringify(posts, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `facebook-posts-${new Date().toISOString().replace(/[:.]/gu, "-")}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `Đã xuất ${posts.length} bài. Ảnh được ghi dưới dạng đường link.`;
    download.disabled = false;
  } catch {
    showError();
  }
});

async function loadStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const state = await chrome.runtime.sendMessage({ type: "GET_STATUS", tabId: tab?.id });
  if (state?.ok === false) throw new Error(state.error);
  const connection = document.querySelector("#connection");
  document.querySelector("#connect").hidden = state.connected;
  document.querySelector("#disconnect").hidden = !state.connected;
  connection.textContent = state.connected
    ? `Đã kết nối: ${state.account || "tài khoản TrọCheck"}. ${state.sync?.error || state.sync?.lastResult || (state.autoSend ? "Bài sẽ tự động gửi về kho." : "Tự động gửi đang tắt; bật lại trong Cài đặt.")}`
    : "Chưa kết nối. Bấm Kết nối tài khoản TrọCheck để gửi các bài đã lưu về kho.";
  let url;
  try { url = new URL(tab?.url); } catch { /* Restricted tabs do not expose their URL. */ }
  if (url?.origin !== "https://www.facebook.com") {
    status.textContent = "Tab này không phải Facebook. Mở một nhóm Facebook hoặc tìm kiếm bài viết rồi cuộn để lưu.";
    return;
  }
  if (!/^\/(?:groups|search)\//u.test(url.pathname)) {
    status.textContent = "Chỉ lưu nhóm và tìm kiếm bài viết Facebook. Hãy mở một nhóm hoặc tìm kiếm bài viết; bảng tin, trang cá nhân và Pages không được lưu.";
    return;
  }
  status.textContent = `Đã lưu ${state.saved} bài trong tab này; kho trên máy có ${state.waiting} bài chờ gửi và ${state.sent} bài đã gửi.`;
  try { download.disabled = !(await readPosts()).length; } catch { showError(); }
}
loadStatus().catch(() => { status.textContent = "Không đọc được trạng thái extension. Mở bảng dữ liệu để kiểm tra."; });

document.querySelector("#connect").addEventListener("click", () => chrome.tabs.create({ url: "https://trocheck.vercel.app/tai-khoan" }));
document.querySelector("#disconnect").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "DISCONNECT" });
  await loadStatus();
});

document.querySelector("#dashboard").addEventListener("click", async () => {
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  } catch {
    status.textContent = "Không mở được bảng dữ liệu. Tải lại extension rồi thử lại.";
  }
});

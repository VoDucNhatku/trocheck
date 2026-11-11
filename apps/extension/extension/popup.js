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
  status.textContent = "Mở một nhóm Facebook hoặc trang tìm kiếm, tải lại trang rồi thử lại.";
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

readPosts().then(posts => {
  status.textContent = `Đã lưu ${posts.length} bài trong tab này.`;
  download.disabled = posts.length === 0;
}).catch(showError);

document.querySelector("#dashboard").addEventListener("click", async () => {
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  } catch {
    status.textContent = "Không mở được bảng dữ liệu. Tải lại extension rồi thử lại.";
  }
});

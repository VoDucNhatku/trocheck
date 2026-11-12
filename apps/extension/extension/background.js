"use strict";
importScripts("privacy.js");
importScripts("storage.js");
importScripts("sync.js");

const IMAGE_ALARM = "download-pending-images";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
let imageDownload = null;

async function downloadPendingImages() {
  if (imageDownload) return imageDownload;
  imageDownload = (async () => {
    while (true) {
      const queued = await TroStorage.nextPendingImage();
      if (!queued) return;
      let blob = null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const url = new URL(queued.image.url);
        if (url.protocol !== "https:") throw new Error("Image URL must use HTTPS.");
        const response = await fetch(url.href, { credentials: "omit", signal: controller.signal });
        const length = Number(response.headers.get("content-length"));
        if (!response.ok || length > MAX_IMAGE_BYTES) throw new Error("Image download failed.");
        const received = await response.blob();
        if (!received.type.startsWith("image/") || received.size > MAX_IMAGE_BYTES || !received.size) {
          throw new Error("Invalid image response.");
        }
        blob = received;
      } catch (_) {
        // Keep the original URL and a durable retry count; never log image URLs.
      } finally {
        clearTimeout(timeout);
      }
      await TroStorage.finishImage(queued.image.id, queued.generation, blob);
    }
  })().finally(() => { imageDownload = null; });
  return imageDownload;
}

function startImageQueue() {
  downloadPendingImages().then(scheduleSend).catch(error => console.error("[TrọCheck Collector] Image queue failed", error.message));
}

// Recreate the alarm whenever the worker starts, including after a browser restart.
if (chrome.alarms) {
  chrome.alarms.create(IMAGE_ALARM, { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === IMAGE_ALARM) { startImageQueue(); sendStored().catch(() => {}); }
    if (alarm.name === SEND_ALARM) sendStored().catch(() => {});
  });
  chrome.runtime.onStartup?.addListener(startImageQueue);
  chrome.runtime.onInstalled?.addListener(startImageQueue);
  startImageQueue();
}

function validatePost(post) {
  if (!post || typeof post.postId !== "string" || !/^[A-Za-z0-9_-]+$/u.test(post.postId) ||
      typeof post.text !== "string" || !Array.isArray(post.images) ||
      !post.images.every(url => typeof url === "string" && /^https?:\/\//u.test(url)) ||
      !["partial", "visible", "expanded"].includes(post.textStatus) ||
      post.imageStatus !== "visible-only" ||
      !["permalink", "photo-set", "comment-link", "marketplace"].includes(post.linkSource)) {
    throw new Error("Invalid raw post fields.");
  }
  const url = new URL(post.postUrl);
  const pathId = url.pathname.match(/^\/(?:groups\/[^/]+\/(?:posts|permalink)|marketplace\/item|[^/]+\/posts)\/([^/]+)\/?$/u)?.[1];
  const queryId = /^\/(?:permalink|story)\.php$/u.test(url.pathname) && url.searchParams.get("id") && url.searchParams.get("story_fbid");
  if (url.origin !== "https://www.facebook.com" || (pathId || queryId) !== post.postId) {
    throw new Error("Post URL does not match its Facebook ID.");
  }
  return post;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type !== "SAVE_RAW_POSTS") return controlMessage(message, sender, sendResponse);
  (async () => {
    const source = new URL(sender.url || "");
    if (!sender.tab || source.origin !== "https://www.facebook.com") throw new Error("Invalid collector sender.");
    if (message.pageUrl && !supportedUrl(message.pageUrl)) throw new Error("Invalid collector page.");
    // sender.url keeps the address the document was loaded with. After Facebook's client-side
    // navigation only the tab URL is current, so that is the one that must be a supported area.
    const currentTab = await chrome.tabs?.get?.(sender.tab.id);
    if (!supportedUrl(currentTab?.url || sender.tab.url || sender.url)) throw new Error("Trang này không được phép lưu. Mở nhóm hoặc tìm kiếm bài viết Facebook.");
    if (!Array.isArray(message.posts) || !message.posts.length) throw new Error("Empty or invalid post batch.");
    const generation = await TroStorage.getGeneration();
    const now = new Date().toISOString();
    const posts = message.posts.map(validatePost);
    const records = posts.filter(post => post.textStatus !== "partial").map(post => ({
      id: `facebook:${post.postId}`, postUrl: post.postUrl,
      text: TroPrivacy.maskPhones(post.text), images: [...new Set(post.images)], time: now,
      raw_text: TroPrivacy.maskPhones(post.raw_text ?? post.text), text_status: post.textStatus, rental_status: null, extracted: 0,
      listing_count: null, image_count: new Set(post.images).size,
      group_id: typeof post.groupId === "string" && /^[A-Za-z0-9._-]{1,100}$/u.test(post.groupId) ? post.groupId : null,
    }));
    const saved = records.length ? await TroStorage.insertBatch(records, generation) : 0;
    if (saved) {
      await tabCount(sender.tab.id, saved);
      if (chrome.alarms) startImageQueue();
      await scheduleSend();
    }
    await updateBadge(sender.tab.id, currentTab?.url || sender.url);
    return { ok: true, saved, partial: posts.length - records.length, duplicates: records.length - saved, note: await sendNote() };
  })().then(sendResponse, error => {
    console.error("[TrọCheck Collector] Storage failed", error);
    sendResponse({ ok: false, error: `Không lưu được bài trên máy: ${error.message || "bộ nhớ không trả lời"}. Mở bảng dữ liệu để kiểm tra dung lượng và xóa bài cũ nếu bộ nhớ đầy.` });
  });
  return true;
});

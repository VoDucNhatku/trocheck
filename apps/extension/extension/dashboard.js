"use strict";

const status = document.querySelector("#status");
const records = document.querySelector("#records");
const refresh = document.querySelector("#refresh");
const next = document.querySelector("#next");
const processRecords = document.querySelector("#processed-records");
const processStatus = document.querySelector("#process-status");
const counts = document.querySelector("#counts");
const classifyButton = document.querySelector("#classify");
const retryUnknownButton = document.querySelector("#retry-unknown");
const extractButton = document.querySelector("#extract");
const settingsStatus = document.querySelector("#settings-status");
const clearStatus = document.querySelector("#clear-status");
// Same web base as the popup (popup.js is not loaded on this page).
const WEB_BASE_URL = "https://trocheck.vercel.app";
document.querySelector("#my-posts-link").href = WEB_BASE_URL + "/bai-cua-toi";
let nextKey = null;
let activePage = "all";
let processing = false;
let processingController = null;
let imageUrls = [];

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function releaseImages() {
  for (const url of imageUrls) URL.revokeObjectURL(url);
  imageUrls = [];
}

function postLink(post) {
  const id = post.id.replace(/^facebook:/u, "");
  const link = element("a", id);
  try {
    const url = new URL(post.postUrl);
    if (url.origin !== "https://www.facebook.com") throw new Error("Invalid URL");
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  } catch (_) {
    return document.createTextNode(id);
  }
}

function imageDetails(post) {
  const details = document.createElement("details");
  details.append(element("summary", String(post.image_count ?? 0)));
  details.addEventListener("toggle", async () => {
    if (!details.open || details.dataset.loaded) return;
    details.dataset.loaded = "true";
    const gallery = element("div", "Đang tải ảnh đã lưu…", "image-gallery");
    details.append(gallery);
    try {
      const images = await TroStorage.readImages(post.id);
      gallery.replaceChildren();
      for (const item of images) {
        if (item.status !== "downloaded" || !(item.data instanceof Blob)) continue;
        const image = document.createElement("img");
        const url = URL.createObjectURL(item.data);
        imageUrls.push(url);
        image.src = url;
        image.alt = `Ảnh đã lưu của bài ${post.id.replace(/^facebook:/u, "")}`;
        image.loading = "lazy";
        gallery.append(image);
      }
      if (!gallery.childElementCount) gallery.textContent = "Chưa có ảnh nào tải xong.";
    } catch (_) {
      gallery.textContent = "Không đọc được ảnh đã lưu.";
    }
  });
  return details;
}

function makeTable(headers) {
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const header = document.createElement("tr");
  for (const name of headers) header.append(element("th", name));
  head.append(header);
  const body = document.createElement("tbody");
  table.append(head, body);
  return { table, body };
}

async function loadPage(after = null) {
  refresh.disabled = true;
  next.disabled = true;
  status.textContent = "Đang đọc dữ liệu…";
  try {
    const page = await TroStorage.readPage({ after });
    releaseImages();
    records.replaceChildren();
    const { table, body } = makeTable(["Mã bài", "Nội dung", "Thời điểm lưu", "Cho thuê?", "Đã trích xuất", "Số căn", "Ảnh"]);
    for (const post of page.posts) {
      const row = document.createElement("tr");
      const id = document.createElement("td");
      id.append(postLink(post));
      row.append(id);
      for (const value of [post.raw_text, post.time, post.rental_status, post.extracted, post.listing_count ?? "—"]) row.append(element("td", String(value ?? "")));
      const images = document.createElement("td");
      images.append(imageDetails(post));
      row.append(images);
      body.append(row);
    }
    records.append(table);
    nextKey = page.next;
    next.hidden = nextKey === null;
    status.textContent = page.total ? `Đã lưu ${page.total} bài. Trang này hiện ${page.posts.length} bài, xếp theo mã.` : "Chưa có bài nào. Mở nhóm Facebook, cuộn để lưu bài rồi tải lại trang này.";
  } catch (_) {
    status.textContent = "Không đọc được dữ liệu.";
  } finally {
    refresh.disabled = false;
    next.disabled = false;
  }
}

const listingFields = ["property_type", "address", "ward", "district", "city", "rent_price", "area", "contact", "additional_info"];
const processFields = ["post_id", "post_url", "rental_status", "listing_count", "rent_price_status", "jev_raw_response", "extraction_model", "extracted_at", ...listingFields, "image_count"];

async function loadProcessed() {
  try {
    const posts = await TroStorage.readProcessingPosts();
    const pendingClassification = posts.filter(post => post.rental_status == null).length;
    const pendingExtraction = posts.filter(post => !post.extracted && post.rental_status === "yes").length;
    const unknownCount = posts.filter(post => !post.extracted && (post.rental_status === "uncertain" || (post.rental_status === "yes" && (post.listing_count === "uncertain" || post.rent_price_status === "uncertain")))).length;
    counts.textContent = `Chưa lọc: ${pendingClassification} · Chờ trích xuất: ${pendingExtraction} · Chưa rõ số căn: ${unknownCount}`;
    const { table, body } = makeTable(processFields);
    for (const post of posts.filter(post => post.rental_status != null)) {
      const listings = post.extracted && post.listings?.length ? post.listings : [null];
      for (const listing of listings) {
        const row = document.createElement("tr");
        for (const field of processFields) {
          const cell = document.createElement("td");
          if (field === "post_id") {
            const link = postLink(post);
            if (listing) link.textContent = listing.post_id;
            cell.append(link);
          }
          else if (field === "post_url") {
            const link = postLink(post);
            if (link.nodeType === Node.ELEMENT_NODE) link.textContent = post.postUrl;
            cell.append(link);
          } else if (field === "image_count") cell.append(imageDetails(post));
          else {
            const value = listingFields.includes(field) ? listing?.[field] : post[field];
            cell.textContent = value == null ? "" : field === "jev_raw_response" ? JSON.stringify(value) : String(value);
          }
          row.append(cell);
        }
        body.append(row);
      }
    }
    processRecords.replaceChildren(table);
    return posts;
  } catch (_) {
    counts.textContent = "Không đọc được dữ liệu xử lý.";
    throw new Error("Không đọc được dữ liệu xử lý.");
  }
}

const promptFields = [["#jev-listing", "jevListing", "jevListing"], ["#jev-price", "jevPrice", "jevPrice"], ["#jev-count", "jevCount", "jevCount"], ["#extraction-prompt", "extractionPrompt", "extraction"], ["#single-prompt", "singlePrompt", "single"], ["#multiple-prompt", "multiplePrompt", "multiple"]];

async function getSettings() {
  if (!globalThis.chrome?.storage?.local) throw new Error("Settings are unavailable.");
  return chrome.storage.local.get(["typesafeApiKey", "jevListing", "jevPrice", "jevCount", "ollamaExtractionModel", "extractionModel", "extractionProvider", "ollamaApiKey", "extractionPrompt", "singlePrompt", "multiplePrompt"]);
}

async function loadSettings() {
  updateStorageUsage();
  try {
    const settings = await getSettings();
    document.querySelector("#typesafe-api-key").value = "";
    document.querySelector("#typesafe-api-key").placeholder = settings.typesafeApiKey ? "Đã lưu key; để trống để giữ nguyên" : "Nhập TypeSafe API key";
    document.querySelector("#extraction-model").value = settings.ollamaExtractionModel ?? (settings.extractionProvider === "ollama" ? settings.extractionModel : "") ?? "";
    document.querySelector("#ollama-api-key").value = "";
    document.querySelector("#ollama-api-key").placeholder = settings.ollamaApiKey ? "Đã lưu key; để trống để giữ nguyên" : "Nhập Ollama API key";
    for (const [id, key, fallback] of promptFields) document.querySelector(id).value = settings[key] || TroProcessing.defaults[fallback];
  } catch (_) {
    settingsStatus.textContent = "Không đọc được cài đặt.";
  }
}

async function updateStorageUsage() {
  const label = document.querySelector("#storage-usage");
  try {
    if (!navigator.storage?.estimate) throw new Error("Storage estimate unavailable");
    const { usage } = await navigator.storage.estimate();
    if (!Number.isFinite(usage)) throw new Error("Storage estimate unavailable");
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = usage;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
    label.textContent = `Dung lượng ước tính: ${unit ? size.toFixed(2) : size} ${units[unit]}`;
  } catch (_) { label.textContent = "Không ước tính được dung lượng."; }
}

async function runProcessing(kind) {
  if (processing) return;
  processing = true;
  const controller = new AbortController();
  processingController = controller;
  classifyButton.disabled = true;
  retryUnknownButton.disabled = true;
  extractButton.disabled = true;
  let succeeded = 0;
  let failed = 0;
  let stopped = false;
  try {
    const settings = await getSettings();
    const model = kind === "extract" ? (settings.ollamaExtractionModel ?? (settings.extractionProvider === "ollama" ? settings.extractionModel : "")) : "jev-latest";
    const apiKey = kind === "extract" ? settings.ollamaApiKey : settings.typesafeApiKey;
    if (!apiKey || !model) {
      processStatus.textContent = "Hãy lưu API key và model trong Cài đặt trước.";
      return;
    }
    const generation = await TroStorage.getGeneration();
    const posts = await TroStorage.readProcessingPosts();
    const eligible = posts.filter(post => {
      if (kind === "classify") return post.rental_status == null;
      if (kind === "unknown") return !post.extracted && (post.rental_status === "uncertain" || (post.rental_status === "yes" && (post.listing_count === "uncertain" || post.rent_price_status === "uncertain")));
      return !post.extracted && post.rental_status === "yes";
    });
    processStatus.textContent = `Đang xử lý ${eligible.length} bài…`;
    for (const post of eligible) {
      if (controller.signal.aborted || await TroStorage.getGeneration() !== generation) { stopped = true; break; }
      if (kind === "extract" && !["single", "multiple"].includes(post.listing_count)) {
        failed++;
        continue;
      }
      try {
        const args = { post, apiKey, model, signal: controller.signal,
          prompt: settings.extractionPrompt,
          singlePrompt: settings.singlePrompt, multiplePrompt: settings.multiplePrompt,
          jevListing: settings.jevListing, jevPrice: settings.jevPrice, jevCount: settings.jevCount };
        const result = await (kind === "extract" ? TroProcessing.extract(args) : TroProcessing.classifyJev(args));
        const save = kind === "classify" ? TroStorage.saveClassification : kind === "unknown" ? TroStorage.saveUnknownDecision : TroStorage.saveExtraction;
        const saved = await save(post.id, result, generation);
        if (!saved) { stopped = true; break; }
        succeeded++;
      } catch (_) {
        if (controller.signal.aborted) { stopped = true; break; }
        failed++;
      }
      processStatus.textContent = `Đang xử lý: ${succeeded} thành công, ${failed} lỗi.`;
    }
    processStatus.textContent = `${succeeded} thành công, ${failed} lỗi.${stopped ? " Đã dừng vì dữ liệu vừa thay đổi." : ""}${kind === "extract" && failed ? " Bài chưa rõ số căn được bỏ qua." : ""}`;
    await loadProcessed();
  } catch (_) {
    processStatus.textContent = `Đã dừng: ${succeeded} thành công, ${failed} lỗi. Kiểm tra cài đặt rồi thử lại.`;
  } finally {
    processing = false;
    processingController = null;
    classifyButton.disabled = false;
    retryUnknownButton.disabled = false;
    extractButton.disabled = false;
  }
}

// Legacy "Xử lý bài" tools (own Jev/Ollama keys) stay hidden unless this stored flag is on.
async function experimentalOn() {
  try { return Boolean((await chrome.storage.local.get(["experimentalTools"])).experimentalTools); }
  catch (_) { return false; }
}

async function applyExperimental() {
  const on = await experimentalOn();
  for (const node of document.querySelectorAll("[data-experimental]")) node.hidden = !on;
  document.querySelector("#experimental-tools").checked = on;
  if (!on && activePage === "process") await showPage("all");
  return on;
}

async function showPage(page) {
  if (page === "process" && !(await experimentalOn())) page = "all";
  activePage = page;
  for (const name of ["all", "process", "settings"]) {
    document.querySelector(`#${name}-page`).hidden = name !== page;
    const tab = document.querySelector(`[data-page="${name}"]`);
    if (name === page) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
  if (page === "all") await loadPage();
  if (page === "process") { try { await loadProcessed(); } catch (_) {} }
  if (page === "settings") { await applyExperimental(); await loadSettings(); }
}

for (const tab of document.querySelectorAll("[data-page]")) tab.addEventListener("click", () => showPage(tab.dataset.page));
refresh.addEventListener("click", () => showPage(activePage));
next.addEventListener("click", () => loadPage(nextKey));
classifyButton.addEventListener("click", () => runProcessing("classify"));
retryUnknownButton.addEventListener("click", () => runProcessing("unknown"));
extractButton.addEventListener("click", () => runProcessing("extract"));
document.querySelector("#experimental-tools").addEventListener("change", async event => {
  try { await chrome.storage.local.set({ experimentalTools: event.target.checked }); }
  catch (_) { event.target.checked = !event.target.checked; }
  await applyExperimental();
});
document.querySelector("#reset-prompts").addEventListener("click", () => {
  for (const [id, , fallback] of promptFields) document.querySelector(id).value = TroProcessing.defaults[fallback];
  settingsStatus.textContent = "Đã khôi phục prompt mặc định. Bấm Lưu cài đặt để áp dụng.";
});
document.querySelector("#settings-form").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const data = { ollamaExtractionModel: document.querySelector("#extraction-model").value.trim() };
    for (const [id, key] of promptFields) data[key] = document.querySelector(id).value.trim();
    const ollamaKey = document.querySelector("#ollama-api-key").value.trim();
    if (ollamaKey) data.ollamaApiKey = ollamaKey;
    const key = document.querySelector("#typesafe-api-key").value.trim();
    if (key) data.typesafeApiKey = key;
    await chrome.storage.local.set(data);
    document.querySelector("#typesafe-api-key").value = "";
    document.querySelector("#ollama-api-key").value = "";
    const saved = await getSettings();
    document.querySelector("#typesafe-api-key").placeholder = saved.typesafeApiKey ? "Đã lưu key; để trống để giữ nguyên" : "Nhập TypeSafe API key";
    document.querySelector("#ollama-api-key").placeholder = saved.ollamaApiKey ? "Đã lưu key; để trống để giữ nguyên" : "Nhập Ollama API key";
    settingsStatus.textContent = "Đã lưu cài đặt.";
  } catch (_) { settingsStatus.textContent = "Không lưu được cài đặt."; }
});
document.querySelector("#clear").addEventListener("click", async () => {
  if (!confirm("Xóa toàn bộ bài, ảnh và kết quả xử lý? Không thể hoàn tác.")) return;
  processingController?.abort();
  const button = document.querySelector("#clear");
  button.disabled = true;
  clearStatus.textContent = "Đang xóa dữ liệu…";
  try {
    await TroStorage.clearAll();
    await updateStorageUsage();
    releaseImages();
    records.replaceChildren();
    processRecords.replaceChildren();
    clearStatus.textContent = "Đã xóa dữ liệu. Cài đặt vẫn được giữ.";
  } catch (_) { clearStatus.textContent = "Không xóa được dữ liệu."; }
  finally { button.disabled = false; }
});
async function updateSendCount() {
  const label = document.querySelector("#send-count");
  try {
    const photos = (await TroStorage.readImagesToUpload()).length;
    label.textContent = `${(await TroStorage.readUnsent()).length} bài chưa gửi về kho TrọCheck${photos ? `, ${photos} ảnh của bài đã gửi đang chờ` : ""}.`;
  } catch (_) { label.textContent = "Không đếm được bài chưa gửi."; }
}

async function loadConnection() {
  const saved = await chrome.storage.local.get(["trocheckApiUrl", "trocheckToken", "trocheckAutoSend", "trocheckAccount", "trocheckSync"]);
  document.querySelector("#trocheck-api").value = saved.trocheckApiUrl || TroCheck.DEFAULT_API_URL;
  document.querySelector("#trocheck-token").placeholder = saved.trocheckToken ? "Đã lưu token; để trống để giữ nguyên" : "Dán token từ trang Tài khoản";
  document.querySelector("#auto-send").checked = saved.trocheckAutoSend !== false;
  document.querySelector("#trocheck-status").textContent = saved.trocheckToken
    ? `Đã kết nối: ${saved.trocheckAccount || "tài khoản TrọCheck"}. ${saved.trocheckSync?.error || saved.trocheckSync?.lastResult || ""}${saved.trocheckSync?.error || !(saved.trocheckSync?.imagesNextAttempt > Date.now()) ? "" : ` ${saved.trocheckSync.imagesError}`}` : "Chưa kết nối. Mở trang Tài khoản để kết nối một lần.";
  return saved;
}

document.querySelector("#trocheck-form").addEventListener("submit", async event => {
  event.preventDefault();
  const label = document.querySelector("#trocheck-status");
  label.textContent = "Đang kiểm tra…";
  try {
    const saved = await chrome.storage.local.get(["trocheckToken"]);
    const apiUrl = TroCheck.normalizeApiUrl(document.querySelector("#trocheck-api").value);
    const token = document.querySelector("#trocheck-token").value.trim() || saved.trocheckToken;
    const result = await chrome.runtime.sendMessage({ type: "CONNECT_MANUAL", apiUrl, token });
    if (!result?.ok) throw new Error(result?.error || "Không kiểm tra được kết nối.");
    document.querySelector("#trocheck-token").value = "";
    await loadConnection();
    label.textContent = `Đã kết nối: ${result.account}`;
  } catch (error) { label.textContent = error.message; }
});

document.querySelector("#send-trocheck").addEventListener("click", async () => {
  const button = document.querySelector("#send-trocheck");
  const label = document.querySelector("#send-status");
  button.disabled = true;
  label.textContent = "Đang gửi…";
  try {
    const answer = await chrome.runtime.sendMessage({ type: "SEND_NOW" });
    if (!answer?.ok) throw new Error(answer?.error || "Không gửi được bài. Kiểm tra kết nối trong Cài đặt.");
    const result = answer.result;
    const photos = result.images?.total ? ` Ảnh: ${result.images.uploaded} ảnh mới, ${result.images.duplicate} ảnh trùng, ${result.images.skipped} ảnh bỏ qua.` : "";
    label.textContent = (result.total
      ? `Đã gửi ${result.total} bài: ${result.created} bài mới, ${result.duplicate} bài trùng, ${result.rejected} bài bị từ chối.`
      : "Không có bài nào cần gửi.") + photos;
  } catch (error) { label.textContent = error.message; }
  finally { button.disabled = false; updateSendCount(); }
});

document.querySelector("#auto-send").addEventListener("change", async event => {
  const answer = await chrome.runtime.sendMessage({ type: "AUTO_SEND", enabled: event.target.checked });
  document.querySelector("#trocheck-status").textContent = answer?.ok
    ? (event.target.checked ? "Đã bật tự động gửi." : "Đã tắt tự động gửi. Bài vẫn được lưu trên máy.") : answer?.error;
});
document.querySelector("#disconnect").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "DISCONNECT" });
  await loadConnection();
});

if (globalThis.chrome?.storage?.local) { updateSendCount(); loadConnection().catch(() => {}); applyExperimental().catch(() => {}); }
window.addEventListener("unload", releaseImages);
loadPage();

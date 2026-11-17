/* Private server progress, shared by the popup and the saved-post dashboard. */
(function (global) {
  "use strict";
  const labels = { queued: "đang chờ", reading: "đang đọc giá, diện tích, vị trí", asking_ai: "đang hỏi AI",
    needs_review: "chờ duyệt", published: "đã công khai", not_published: "không đăng", failed: "gặp lỗi" };
  const wait = seconds => seconds == null ? "" : seconds < 60
    ? `khoảng ${Math.max(1, Math.ceil(seconds))} giây` : `khoảng ${Math.ceil(seconds / 60)} phút`;
  function stageText(p) {
    const estimate = wait(p.estimated_wait_seconds);
    const reason = ["llm_daily_limit", "review_bot_daily_limit"].includes(p.reason) ? "Đã hết lượt AI hôm nay, chờ sang ngày mới"
      : p.stage === "failed" ? (p.reason === "TimeoutError" ? "Hết thời gian chờ đọc bài" : "Chưa đọc được bài sau các lần thử")
      : p.reason === "not_rental" ? "Không phải bài chào thuê" : p.reason === "rejected" ? "Tin bị từ chối hoặc đánh dấu trùng" : p.reason;
    return (labels[p.stage] || "đang chờ") + (p.queue_position == null ? "" : ` · vị trí ${p.queue_position}`)
      + (estimate ? ` (${estimate})` : "") + (reason ? ` · ${reason}` : "");
  }
  function mount(container) {
    let timer, stopped = false, active = false, request = 0;
    const stop = () => { stopped = true; request++; clearTimeout(timer); chrome.storage?.onChanged?.removeListener(changed); };
    const changed = changes => {
      if (changes.trocheckToken || changes.trocheckSync) {
        container.replaceChildren();
        refresh();
      }
    };
    chrome.storage?.onChanged?.addListener(changed);
    global.addEventListener("pagehide", () => { stop(); chrome.storage?.onChanged?.removeListener(changed); }, { once: true });
    async function refresh() {
      const current = ++request;
      clearTimeout(timer);
      try {
        const state = await chrome.runtime.sendMessage({ type: "GET_POST_PROGRESS" });
        if (stopped || current !== request) return;
        container.replaceChildren();
        if (state?.connected && state.summary) {
          if (state.ok === false) throw new Error(state.error);
          active = state.summary.active;
          const summary = document.createElement("p");
          const estimate = wait(state.summary.estimated_wait_seconds);
          summary.textContent = Object.entries(state.summary.stage_counts || {}).filter(([, n]) => n > 0)
            .map(([stage, n]) => `${n} bài ${labels[stage] || stage}${stage === "queued" && estimate ? ` (${estimate})` : ""}`).join(" · ");
          container.append(summary);
          for (const post of state.items || []) {
            if (!post.progress) continue;
            const line = document.createElement("p");
            line.textContent = `${post.excerpt.slice(0, 70)}: ${stageText(post.progress)}`;
            container.append(line);
          }
        } else if (state?.ok === false) throw new Error(state.error);
        else active = false;
      } catch {
        if (stopped || current !== request) return;
        container.textContent = "Chưa tải được tiến độ trên máy chủ. Mở Bài của tôi để kiểm tra.";
      }
      if (!stopped && active) timer = setTimeout(refresh, 5000);
    }
    refresh();
    return { refresh, stop };
  }
  global.TroPostProgress = { mount, stageText };
})(globalThis);

/* Keep an in-tab export snapshot and persist acknowledged batches. */
(function () {
  "use strict";
  globalThis.troCollector?.stop();
  const records = new Map();
  const collector = globalThis.TroCollector.observePosts({
    document,
    async onPosts(batch) {
      const masked = batch.map(post => ({ ...post, text: TroPrivacy.maskPhones(post.text), ...(post.raw_text === undefined ? {} : { raw_text: TroPrivacy.maskPhones(post.raw_text) }) }));
      for (const post of masked) records.set(post.postUrl, post);
      const response = await chrome.runtime.sendMessage({ type: "SAVE_RAW_POSTS", posts: masked });
      if (!response?.ok) throw new Error(response?.error || "Background did not acknowledge the batch.");
      console.info("[TrọCheck Collector] Batch processed", response);
    },
  });
  globalThis.troCollector = {
    stop: collector.stop,
    flush: collector.flush,
    snapshot: () => [...records.values()],
  };
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id || message?.type !== "GET_COLLECTED_POSTS") return;
      sendResponse({ posts: globalThis.troCollector.snapshot() });
    });
  }
})();

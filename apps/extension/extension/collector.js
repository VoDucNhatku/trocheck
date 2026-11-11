/* DOM-only extraction. No network requests, storage, or page-owned JavaScript. */
(function (global) {
  "use strict";

  const MESSAGE = '[data-ad-rendering-role="story_message"], [data-ad-preview="message"], [data-ad-comet-preview="message"]';
  const PROFILE = '[data-ad-rendering-role="profile_name"]';
  const BLOCKS = new Set(["DIV", "P", "LI", "BLOCKQUOTE", "UL", "OL"]);
  const MORE = /^(see more|show more|xem thêm)$/iu;
  const LESS = /^(see less|show less|ẩn bớt|thu gọn)$/iu;

  function elements(scope, selector) {
    return [
      ...(scope.nodeType === 1 && scope.matches(selector) ? [scope] : []),
      ...scope.querySelectorAll(selector),
    ];
  }

  function isComment(element) {
    for (let node = element; node?.nodeType === 1; node = node.parentElement) {
      if (node.hasAttribute("data-commentid")) return true;
      if (node.getAttribute("role") === "article" && /^(comment by|bình luận của)/iu.test(node.getAttribute("aria-label") || "")) return true;
    }
    return false;
  }

  function isHidden(element) {
    for (let node = element; node?.nodeType === 1; node = node.parentElement) {
      if (node.hidden || node.getAttribute("aria-hidden") === "true" ||
        node.style.display === "none" || node.style.visibility === "hidden") return true;
    }
    return false;
  }

  function messages(scope) {
    return elements(scope, MESSAGE).filter(node =>
      !node.parentElement?.closest(MESSAGE) && !isComment(node) && !isHidden(node));
  }

  function findPostRoot(message) {
    const feed = message.closest('[role="feed"]');
    let card = message;
    if (feed) {
      while (card.parentElement && card.parentElement !== feed) card = card.parentElement;
      if (card.parentElement === feed && messages(card).length === 1) return card;
    }
    for (let node = message.parentElement; node && node !== feed; node = node.parentElement) {
      if (messages(node).length > 1) break;
      if (node.querySelector(PROFILE)) return node;
      if (node.getAttribute("role") === "article" && !isComment(node)) return node;
    }
    return null;
  }

  function postRoots(scope) {
    const roots = new Set(messages(scope).map(findPostRoot).filter(Boolean));
    // A changed image or header is a sibling of the message, not its ancestor.
    const element = scope.nodeType === 1 ? scope : scope.parentElement;
    const feed = element?.closest('[role="feed"]');
    if (feed) {
      let card = element;
      while (card.parentElement && card.parentElement !== feed) card = card.parentElement;
      if (card !== feed && card.parentElement === feed) roots.add(card);
    } else if (element) {
      const article = element.closest('[role="article"]');
      if (article && !isComment(article)) roots.add(article);
    }
    // Nested batches can wrap multiple cards under one feed child.
    for (let node = element; node && node !== feed; node = node.parentElement) {
      if (["BODY", "HTML"].includes(node.tagName)) break;
      const anchors = messages(node);
      if (anchors.length === 1) {
        const root = findPostRoot(anchors[0]);
        if (root) roots.add(root);
        break;
      }
      if (anchors.length > 1) break;
    }
    // Photo-only posts still need author evidence to avoid loading placeholders.
    for (const feedNode of elements(scope, '[role="feed"]')) {
      for (const card of feedNode.children) {
        if (card.querySelector(PROFILE) && card.querySelector('a[href*="/photo/"] img')) roots.add(card);
      }
    }
    return [...roots].filter(root => !isComment(root) && !isHidden(root));
  }

  function facebookUrl(value, baseUrl) {
    try {
      const url = new URL(value, baseUrl);
      if (url.protocol !== "https:" || !(url.hostname === "facebook.com" || url.hostname.endsWith(".facebook.com"))) return null;
      return url;
    } catch {
      return null;
    }
  }

  function permalink(url) {
    let match = url.pathname.match(/^\/groups\/([^/]+)\/(?:posts|permalink)\/([^/]+)\/?$/u);
    if (match) return { postId: match[2], postUrl: `https://www.facebook.com/groups/${match[1]}/posts/${match[2]}/` };
    match = url.pathname.match(/^\/([^/]+)\/posts\/([^/]+)\/?$/u);
    if (match) return { postId: match[2], postUrl: `https://www.facebook.com/${match[1]}/posts/${match[2]}/` };
    if (/^\/(?:permalink|story)\.php$/u.test(url.pathname) && url.searchParams.get("story_fbid") && url.searchParams.get("id")) {
      const query = new URLSearchParams({ story_fbid: url.searchParams.get("story_fbid"), id: url.searchParams.get("id") });
      return { postId: query.get("story_fbid"), postUrl: `https://www.facebook.com/permalink.php?${query}` };
    }
    return null;
  }

  function photoId(anchor, baseUrl) {
    const url = facebookUrl(anchor.getAttribute("href"), baseUrl);
    if (!url || !/^\/photo(?:\/|\.php$)/u.test(url.pathname)) return null;
    // Albums use pcb.<post id>; a group post with one photo uses gm.<post id>.
    return url.searchParams.get("set")?.match(/^(?:pcb|gm)\.(\d+)$/u)?.[1] || null;
  }

  function listingId(anchor, baseUrl) {
    const url = facebookUrl(anchor.getAttribute("href"), baseUrl);
    return url?.pathname.match(/^\/(?:commerce\/listing|marketplace\/item)\/(\d+)\/?$/u)?.[1] || null;
  }

  /** The one group a card links to outside its message, or null when there is none or several. */
  function cardGroup(root, baseUrl) {
    const messageNodes = messages(root);
    const groups = new Set([...root.querySelectorAll("a[href]")]
      .filter(link => !isComment(link) && !messageNodes.some(message => message.contains(link)))
      .map(link => facebookUrl(link.getAttribute("href"), baseUrl)?.pathname.match(/^\/groups\/([^/]+)(?:\/user\/[^/]+)?\/?$/u)?.[1])
      .filter(Boolean));
    return groups.size === 1 ? [...groups][0] : null;
  }

  function identity(root, messageNodes, baseUrl) {
    const links = [...root.querySelectorAll("a[href]")];
    const photos = links.filter(link => !isComment(link) && link.querySelector("img") && photoId(link, baseUrl));
    const photoIds = new Set(photos.map(link => photoId(link, baseUrl)));
    const direct = links.filter(link => !isComment(link) && !messageNodes.some(message => message.contains(link)))
      .map(link => facebookUrl(link.getAttribute("href"), baseUrl))
      .filter(url => url && !url.searchParams.has("comment_id") && !url.searchParams.has("reply_comment_id"))
      .map(permalink).filter(Boolean);
    const unique = new Map(direct.map(value => [value.postUrl, value]));
    if (unique.size > 1 || photoIds.size > 1) return null;
    if (unique.size === 1) {
      const value = unique.values().next().value;
      if (photoIds.size && !photoIds.has(value.postId)) return null;
      return { ...value, linkSource: "permalink" };
    }
    const id = [...photoIds][0];
    if (id) {
      // Search/results pages can contain posts from different groups.
      const authorGroups = new Set(elements(root, PROFILE).filter(profile => !isComment(profile))
        .flatMap(profile => [...profile.querySelectorAll('a[href]')])
        .map(link => facebookUrl(link.getAttribute("href"), baseUrl)?.pathname.match(/^\/groups\/([^/]+)\/user\//u)?.[1])
        .filter(Boolean));
      const relatedGroups = new Set(links.map(link => facebookUrl(link.getAttribute("href"), baseUrl))
        .filter(Boolean).filter(url => permalink(url)?.postId === id)
        .map(url => url.pathname.match(/^\/groups\/([^/]+)/u)?.[1]).filter(Boolean));
      const page = facebookUrl(baseUrl, baseUrl);
      // Search results keep the group link outside the author name, so fall back to the card's single group.
      const group = authorGroups.size === 1 ? [...authorGroups][0] :
        relatedGroups.size === 1 ? [...relatedGroups][0] :
          cardGroup(root, baseUrl) ?? page?.pathname.match(/^\/groups\/([^/]+)/u)?.[1];
      if (group) return { postId: id, postUrl: `https://www.facebook.com/groups/${group}/posts/${id}/`, linkSource: "photo-set" };
    }
    // A Marketplace listing shared in a group carries no post id, only its listing id.
    const listings = new Set(links.filter(link => !isComment(link) && !messageNodes.some(message => message.contains(link)))
      .map(link => listingId(link, baseUrl)).filter(Boolean));
    if (!id && listings.size === 1) {
      const listing = [...listings][0];
      return { postId: listing, postUrl: `https://www.facebook.com/marketplace/item/${listing}/`, linkSource: "marketplace" };
    }
    const comments = links.map(link => facebookUrl(link.getAttribute("href"), baseUrl)).filter(Boolean)
      .filter(url => url.searchParams.has("comment_id") || url.searchParams.has("reply_comment_id"))
      .map(permalink).filter(value => value && (!id || value.postId === id));
    const parents = new Map(comments.map(value => [value.postUrl, value]));
    if (parents.size === 1) return { ...parents.values().next().value, linkSource: "comment-link" };
    return null;
  }

  function textOf(element) {
    function read(node) {
      if (node.nodeType === 3) return node.nodeValue;
      if (node.nodeType !== 1 || isHidden(node) || isComment(node)) return "";
      if (["SCRIPT", "STYLE", "NOSCRIPT", "BUTTON"].includes(node.tagName) || node.getAttribute("role") === "button") return "";
      if (node.tagName === "BR") return "\n";
      if (node.tagName === "IMG") return node.getAttribute("alt") || "";
      const value = [...node.childNodes].map(read).join("");
      return BLOCKS.has(node.tagName) ? `\n${value}\n` : value;
    }
    return read(element).replace(/[\t\f\v \u00a0]+/gu, " ").replace(/ *\n */gu, "\n").replace(/\n{3,}/gu, "\n\n").trim();
  }

  function controls(messageNodes, pattern) {
    return messageNodes.flatMap(message => [...message.querySelectorAll('button, [role="button"]')])
      .filter(button => !isComment(button) && !isHidden(button) && pattern.test(button.textContent.trim()));
  }

  function imageSource(image, baseUrl) {
    const value = image.currentSrc || image.getAttribute("src");
    try {
      const url = new URL(value || "", baseUrl);
      return value && /^https?:$/u.test(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  function mediaScope(root, message) {
    if (!message) return root;
    for (let boundary = message.parentElement; boundary; boundary = boundary.parentElement) {
      if (boundary.querySelector(PROFILE)) {
        let branch = message;
        while (branch.parentElement && branch.parentElement !== boundary) branch = branch.parentElement;
        return branch;
      }
      if (boundary === root) break;
    }
    return message;
  }

  function groupOf(root, postUrl, baseUrl) {
    return facebookUrl(postUrl, baseUrl)?.pathname.match(/^\/groups\/([^/]+)\//u)?.[1] ??
      (/\/marketplace\/item\//u.test(postUrl) ? cardGroup(root, baseUrl) : null);
  }

  function groupName(root, postUrl, baseUrl) {
    const group = groupOf(root, postUrl, baseUrl);
    if (!group) return null;
    const authorGroups = new Set(elements(root, PROFILE).filter(profile => !isComment(profile))
      .flatMap(profile => [...profile.querySelectorAll('a[href]')])
      .map(link => facebookUrl(link.getAttribute("href"), baseUrl)?.pathname.match(/^\/groups\/([^/]+)\/user\//u)?.[1])
      .filter(Boolean));
    const aliases = new Set([group, ...(authorGroups.size === 1 ? authorGroups : [])]);
    const groupLinks = [...root.querySelectorAll('a[href]')].filter(link => {
      const url = facebookUrl(link.getAttribute("href"), baseUrl);
      const linkedGroup = url?.pathname.match(/^\/groups\/([^/]+)\/?$/u)?.[1];
      return aliases.has(linkedGroup) &&
        !isComment(link) && !isHidden(link) && !link.closest(MESSAGE);
    });
    const names = new Set(groupLinks.map(textOf).filter(Boolean));
    if (names.size === 1) return [...names][0];
    if (names.size > 1) return null;
    const page = facebookUrl(baseUrl, baseUrl);
    const pageGroup = page?.pathname.match(/^\/groups\/([^/]+)(?:\/|$)/u)?.[1];
    if (!aliases.has(pageGroup)) return null;
    const headings = [...root.ownerDocument.querySelectorAll("h1")]
      .filter(node => !root.contains(node) && !isHidden(node)).map(textOf).filter(Boolean);
    return headings.length === 1 ? headings[0] : null;
  }

  function extractPost(root, { baseUrl = root.ownerDocument.URL } = {}) {
    if (isComment(root) || isHidden(root)) return null;
    const messageNodes = messages(root);
    // Ambiguous containers must not merge multiple posts into one record.
    if (messageNodes.length > 1) return null;
    const key = identity(root, messageNodes, baseUrl);
    if (!key) return null;
    const text = messageNodes.map(textOf).join("\n\n");
    const media = mediaScope(root, messageNodes[0]);
    const images = [...new Set([...root.querySelectorAll('a[href]')]
      .filter(anchor => !isComment(anchor) && !isHidden(anchor))
      .filter(anchor => photoId(anchor, baseUrl) === key.postId ||
        (key.linkSource === "marketplace" && listingId(anchor, baseUrl) === key.postId) ||
        (!photoId(anchor, baseUrl) && media.contains(anchor) &&
          /^\/photo(?:\/|\.php$)/u.test(facebookUrl(anchor.getAttribute("href"), baseUrl)?.pathname || "")))
      .flatMap(anchor => [...anchor.querySelectorAll("img")])
      .filter(image => !isHidden(image))
      .map(image => imageSource(image, baseUrl)).filter(Boolean))];
    if (!text && images.length === 0) return null;
    const group = groupName(root, key.postUrl, baseUrl);
    return {
      ...key,
      text,
      images,
      groupName: group,
      groupId: groupOf(root, key.postUrl, baseUrl),
      raw_text: group ? `Group: ${group}\n\n${text}` : text,
      rental_status: null,
      extracted: 0,
      listing_count: null,
      image_count: images.length,
      textStatus: controls(messageNodes, MORE).length ? "partial" : controls(messageNodes, LESS).length ? "expanded" : "visible",
      imageStatus: "visible-only",
    };
  }

  function collectPosts(scope, options = {}) {
    const records = postRoots(scope).map(root => extractPost(root, options)).filter(Boolean);
    return [...new Map(records.map(record => [record.postUrl, record])).values()];
  }

  function observePosts({ document, onPosts, debounceMs = 80, expand = true, expansionTimeoutMs = 500, maxSeen = 500 }) {
    const win = document.defaultView;
    const pending = new Set();
    const seen = new Map();
    const clicked = new WeakSet();
    const expandedTexts = new WeakMap();
    const expansionAttempts = new Map();
    const cancellations = new Set();
    let stopped = false;
    let timer = null;
    let running = null;

    function enqueue(scope) {
      if (scope?.isConnected || scope === document) pending.add(scope);
    }

    function schedule() {
      if (stopped || timer !== null) return;
      timer = win.setTimeout(() => { timer = null; flush().catch(error => console.error("Collector failed", error)); }, debounceMs);
    }

    const observer = new win.MutationObserver(changes => {
      for (const change of changes) {
        // Comments and the document have no closest(); only elements are searched from.
        const node = change.target.nodeType === 3 ? change.target.parentElement : change.target;
        const target = node?.nodeType === 1 ? node : null;
        if (target && isComment(target)) continue;
        // Added cards carry their own scope; do not rescan the entire feed.
        const inPostArea = target?.closest('[role="feed"], [role="article"], ' + MESSAGE);
        if (inPostArea && (change.type !== "childList" || target?.getAttribute("role") !== "feed")) enqueue(target);
        for (const added of change.addedNodes) if (added.nodeType === 1) enqueue(added);
      }
      if (pending.size) schedule();
    });

    function expandMessage(root, button) {
      return new Promise(resolve => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          watcher.disconnect();
          win.clearTimeout(timeout);
          cancellations.delete(finish);
          resolve();
        };
        const watcher = new win.MutationObserver(() => {
          if (!root.isConnected || !button.isConnected || !MORE.test(button.textContent.trim())) finish();
        });
        const timeout = win.setTimeout(finish, expansionTimeoutMs);
        cancellations.add(finish);
        watcher.observe(root, { childList: true, subtree: true, characterData: true });
        clicked.add(button);
        button.click();
        if (!button.isConnected || !MORE.test(button.textContent.trim())) finish();
      });
    }

    async function drain() {
      while (pending.size && !stopped) {
        const scopes = [...pending];
        pending.clear();
        const roots = new Set(scopes.filter(scope => scope.isConnected || scope === document).flatMap(postRoots));
        const batch = new Map();
        for (const root of roots) {
          if (stopped || !root.isConnected) continue;
          if (expand) {
            for (const button of controls(messages(root), MORE)) {
              if (!clicked.has(button)) {
                const before = messages(root).map(textOf).join("\n\n");
                const postUrl = identity(root, messages(root), document.URL)?.postUrl;
                const attempt = postUrl && `${postUrl}\n${before}`;
                if (attempt && expansionAttempts.has(attempt)) continue;
                if (attempt) {
                  expansionAttempts.set(attempt, true);
                  while (expansionAttempts.size > maxSeen) expansionAttempts.delete(expansionAttempts.keys().next().value);
                }
                await expandMessage(root, button);
                const after = messages(root).map(textOf).join("\n\n");
                if (before !== after && !controls(messages(root), MORE).length) expandedTexts.set(root, after);
              }
            }
          }
          if (stopped || !root.isConnected) continue;
          const record = extractPost(root, { baseUrl: document.URL });
          if (!record) continue;
          if (record.textStatus === "visible" && expandedTexts.get(root) === record.text) record.textStatus = "expanded";
          const fingerprint = JSON.stringify(record);
          if (seen.get(record.postUrl) === fingerprint) continue;
          batch.set(record.postUrl, { record, fingerprint });
        }
        if (batch.size && !stopped) {
          try {
            await onPosts([...batch.values()].map(value => value.record));
            for (const [url, { fingerprint }] of batch) {
              seen.delete(url);
              seen.set(url, fingerprint);
            }
            while (seen.size > maxSeen) seen.delete(seen.keys().next().value);
          } catch (error) {
            for (const root of roots) enqueue(root);
            throw error;
          }
        }
      }
    }

    async function flush() {
      if (timer !== null) { win.clearTimeout(timer); timer = null; }
      // Let queued mutation records enter the work queue before draining it.
      await Promise.resolve();
      if (running) { await running; if (pending.size && !stopped) return flush(); return; }
      running = drain();
      try { await running; } finally { running = null; }
    }

    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ["src", "srcset", "href", "hidden", "aria-hidden", "style", "data-ad-rendering-role", "data-ad-preview", "data-ad-comet-preview"],
    });
    enqueue(document);
    schedule();
    return {
      flush,
      stop() {
        stopped = true;
        observer.disconnect();
        if (timer !== null) win.clearTimeout(timer);
        timer = null;
        pending.clear();
        for (const cancel of [...cancellations]) cancel();
      },
    };
  }

  const api = { collectPosts, extractPost, observePosts };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.TroCollector = api;
})(globalThis);

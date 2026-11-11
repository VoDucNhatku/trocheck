/* Extension-owned IndexedDB. Raw posts, listings and image data are stored separately. */
(function (global) {
  "use strict";

  const DATABASE_VERSION = 5;
  const postId = id => String(id).replace(/^facebook:/u, "");

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("tro-collector", DATABASE_VERSION);
      request.onupgradeneeded = event => {
        const db = request.result;
        const transaction = request.transaction;
        if (event.oldVersion === 4) {
          const oldListings = transaction.objectStore("listings");
          const oldKeyPath = oldListings.keyPath;
          const entries = oldListings.getAll();
          entries.onsuccess = () => {
            const records = entries.result;
            db.deleteObjectStore("listings");
            const listings = db.createObjectStore("listings", { keyPath: "post_id" });
            listings.createIndex("source_post_id", "source_post_id");
            for (const record of records) {
              const sourcePostId = record.post_id;
              const unitPostId = record[oldKeyPath];
              delete record[oldKeyPath];
              listings.add({ ...record, post_id: unitPostId, source_post_id: sourcePostId });
            }
          };
          return;
        }
        const raw = event.oldVersion < 2 ? db.createObjectStore("raw-posts", { keyPath: "id" }) : transaction.objectStore("raw-posts");
        const images = db.createObjectStore("images", { keyPath: "id" });
        images.createIndex("post_id", "post_id");
        const listings = db.createObjectStore("listings", { keyPath: "post_id" });
        listings.createIndex("source_post_id", "source_post_id");
        db.createObjectStore("metadata", { keyPath: "key" });

        function migrate(post) {
          const urls = Array.isArray(post.images) ? [...new Set(post.images.filter(url => typeof url === "string"))] : [];
          const normalized = { ...post, raw_text: post.raw_text ?? post.text ?? "", rental_status: post.rental_status ?? null,
            extracted: post.extracted ?? 0, listing_count: post.listing_count ?? null,
            image_count: post.image_count ?? urls.length };
          delete normalized.images;
          urls.forEach((url, index) => images.add({ id: `image_${postId(post.id)}_${index + 1}`, post_id: postId(post.id),
            url, status: "pending", attempts: 0, nextAttemptAt: 0 }));
          return normalized;
        }
        // Preserve the legacy store; copy only records eligible for the current schema.
        if (event.oldVersion < 2 && db.objectStoreNames.contains("posts")) {
          transaction.objectStore("posts").openCursor().onsuccess = event => {
            const cursor = event.target.result;
            if (!cursor) return;
            const post = cursor.value;
            if (["visible", "expanded"].includes(post.textStatus)) {
              raw.add(migrate({ id: post.id, postUrl: post.postUrl, text: post.text,
                images: post.images, time: post.firstSeenAt }));
            }
            cursor.continue();
          };
        } else if (event.oldVersion >= 2) {
          raw.openCursor().onsuccess = event => {
            const cursor = event.target.result;
            if (!cursor) return;
            cursor.update(migrate(cursor.value));
            cursor.continue();
          };
        }
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Database upgrade blocked. Close other extension pages and retry."));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
    });
  }

  async function insertBatch(records, expectedGeneration = null) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["raw-posts", "images", "metadata"], "readwrite");
      const store = transaction.objectStore("raw-posts");
      const images = transaction.objectStore("images");
      let saved = 0;
      transaction.oncomplete = () => { db.close(); resolve(saved); };
      let stale = false;
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error(stale ? "Data was cleared before the batch could be saved." : "Storage transaction aborted.")); };
      function insertNext(index) {
        if (index === records.length) return;
        const record = records[index];
        const request = store.get(record.id);
        request.onsuccess = () => {
          if (request.result !== undefined) {
            const existing = request.result;
            if (existing.text === record.text && existing.raw_text === existing.text &&
                record.raw_text !== record.text && record.raw_text.endsWith(`\n\n${record.text}`)) {
              store.put({ ...existing, raw_text: record.raw_text }).onsuccess = () => insertNext(index + 1);
            } else insertNext(index + 1);
            return;
          }
          const urls = Array.isArray(record.images) ? [...new Set(record.images)] : [];
          const raw = { ...record };
          delete raw.images;
          const write = store.add(raw);
          urls.forEach((url, i) => images.add({ id: `image_${postId(record.id)}_${i + 1}`,
            post_id: postId(record.id), url, status: "pending", attempts: 0, nextAttemptAt: 0 }));
          write.onsuccess = () => { saved++; insertNext(index + 1); };
        };
      }
      const generation = transaction.objectStore("metadata").get("generation");
      generation.onsuccess = () => {
        if (expectedGeneration !== null && (generation.result?.value ?? 0) !== expectedGeneration) {
          stale = true;
          transaction.abort();
        } else insertNext(0);
      };
    });
  }

  async function readPage({ after = null, limit = 50 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid page size.");
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("raw-posts", "readonly");
      const store = transaction.objectStore("raw-posts");
      const posts = [];
      let total = 0;
      let next = null;
      transaction.oncomplete = () => { db.close(); resolve({ posts, total, next }); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Storage read aborted.")); };
      store.count().onsuccess = event => { total = event.target.result; };
      store.openCursor(after === null ? null : IDBKeyRange.lowerBound(after, true)).onsuccess = event => {
        const cursor = event.target.result;
        if (!cursor) return;
        if (posts.length === limit) { next = posts.at(-1).id; return; }
        posts.push(cursor.value);
        cursor.continue();
      };
    });
  }

  async function readImages(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("images", "readonly");
      const request = transaction.objectStore("images").index("post_id").getAll(postId(id));
      transaction.oncomplete = () => { db.close(); resolve(request.result); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Image read aborted.")); };
    });
  }

  async function getGeneration() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("metadata", "readonly");
      const request = transaction.objectStore("metadata").get("generation");
      transaction.oncomplete = () => { db.close(); resolve(request.result?.value ?? 0); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Storage read aborted.")); };
    });
  }

  async function clearAll() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const names = ["raw-posts", "images", "listings", "metadata"];
      if (db.objectStoreNames.contains("posts")) names.push("posts");
      const transaction = db.transaction(names, "readwrite");
      const metadata = transaction.objectStore("metadata");
      const generation = metadata.get("generation");
      generation.onsuccess = () => metadata.put({ key: "generation", value: (generation.result?.value ?? 0) + 1 });
      for (const name of names) if (name !== "metadata") transaction.objectStore(name).clear();
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Clear data aborted.")); };
    });
  }

  async function nextPendingImage() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["images", "metadata"], "readonly");
      const generation = transaction.objectStore("metadata").get("generation");
      let image = null;
      transaction.objectStore("images").openCursor().onsuccess = event => {
        const cursor = event.target.result;
        if (!cursor) return;
        if (cursor.value.status === "pending" && (cursor.value.nextAttemptAt || 0) <= Date.now()) image = cursor.value;
        else cursor.continue();
      };
      transaction.oncomplete = () => { db.close(); resolve(image ? { image, generation: generation.result?.value ?? 0 } : null); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Image queue read aborted.")); };
    });
  }

  async function finishImage(id, expectedGeneration, blob) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["images", "metadata"], "readwrite");
      const images = transaction.objectStore("images");
      const generation = transaction.objectStore("metadata").get("generation");
      generation.onsuccess = () => {
        if ((generation.result?.value ?? 0) !== expectedGeneration) return;
        const request = images.get(id);
        request.onsuccess = () => {
          const item = request.result;
          if (!item || item.status !== "pending") return;
          if (blob) images.put({ ...item, status: "downloaded", data: blob });
          else {
            const attempts = item.attempts + 1;
            images.put({ ...item, attempts, status: attempts >= 3 ? "failed" : "pending", nextAttemptAt: Date.now() + 60000 });
          }
        };
      };
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Image update aborted.")); };
    });
  }

  async function readProcessingPosts() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["raw-posts", "listings"], "readonly");
      const posts = transaction.objectStore("raw-posts").getAll();
      const listings = transaction.objectStore("listings").getAll();
      transaction.oncomplete = () => {
        db.close();
        const byPost = new Map();
        for (const listing of listings.result) {
          if (!byPost.has(listing.source_post_id)) byPost.set(listing.source_post_id, []);
          byPost.get(listing.source_post_id).push(listing);
        }
        resolve(posts.result.map(post => ({ ...post, listings: byPost.get(postId(post.id)) || [] })));
      };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Processing read aborted.")); };
    });
  }

  async function saveProcessing(id, result, expectedGeneration, extraction, retryUnknown = false) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["raw-posts", "listings", "metadata"], "readwrite");
      const raw = transaction.objectStore("raw-posts");
      const generation = transaction.objectStore("metadata").get("generation");
      let saved = false;
      generation.onsuccess = () => {
        if ((generation.result?.value ?? 0) !== expectedGeneration) return;
        const request = raw.get(id);
        request.onsuccess = () => {
          const post = request.result;
          if (!post) return;
          if (!extraction) {
            if (retryUnknown ? !(post.extracted === 0 && (post.rental_status === "uncertain" || (post.rental_status === "yes" && (post.listing_count === "uncertain" || post.rent_price_status === "uncertain")))) : post.rental_status != null) return;
            raw.put({ ...post, ...result });
          } else {
            if (post.extracted !== 0 || post.rental_status !== "yes" || !["single", "multiple"].includes(post.listing_count)) return;
            if (!Array.isArray(result.listings) || !result.listings.length) return;
            const listingStore = transaction.objectStore("listings");
            result.listings.forEach((listing, index) => listingStore.add({ ...listing,
              post_id: `${postId(id)}_${index + 1}`, source_post_id: postId(id) }));
            raw.put({ ...post, extraction_model: result.extraction_model, extracted_at: result.extracted_at, extracted: 1 });
          }
          saved = true;
        };
      };
      transaction.oncomplete = () => { db.close(); resolve(saved); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Processing write aborted.")); };
    });
  }

  const saveClassification = (id, result, generation) => saveProcessing(id, result, generation, false);
  const saveUnknownDecision = (id, result, generation) => saveProcessing(id, result, generation, false, true);
  const saveExtraction = (id, result, generation) => saveProcessing(id, result, generation, true);
  async function readUnsent() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const all = db.transaction("raw-posts").objectStore("raw-posts").getAll();
      all.onsuccess = () => { db.close(); resolve(all.result.filter(post => !post.sent_at)); };
      all.onerror = () => { db.close(); reject(all.error); };
    });
  }

  async function markSent(items) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("raw-posts", "readwrite");
      const store = transaction.objectStore("raw-posts");
      const now = new Date().toISOString();
      for (const { id, status } of items) {
        const request = store.get(id);
        request.onsuccess = () => { if (request.result) store.put({ ...request.result, sent_at: now, sent_status: status }); };
      }
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error); };
    });
  }

  global.TroStorage = { readUnsent, markSent, openDatabase, insertBatch, readPage, readImages, getGeneration, clearAll, nextPendingImage,
    finishImage, readProcessingPosts, saveClassification, saveUnknownDecision, saveExtraction };
})(globalThis);

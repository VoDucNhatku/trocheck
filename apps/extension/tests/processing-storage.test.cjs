const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

function storage() {
  const context = vm.createContext({ indexedDB: new IDBFactory(), IDBKeyRange });
  vm.runInContext(fs.readFileSync(`${__dirname}/../extension/storage.js`, 'utf8'), context);
  return context.TroStorage;
}

test('classification and multiple listings are stored atomically against the original post', async () => {
  const db = storage();
  await db.insertBatch([{ id: 'facebook:123', raw_text: 'Two rooms', rental_status: null, extracted: 0,
    listing_count: "uncertain", image_count: 0 }]);
  const generation = await db.getGeneration();
  assert.equal(await db.saveExtraction('facebook:123', { listings: [{}] }, generation), false);
  assert.equal(await db.saveClassification('facebook:123', { rental_status: "yes", listing_count: "multiple",
    decision_model: 'test', classified_at: 'now' }, generation), true);
  assert.equal(await db.saveClassification('facebook:123', { rental_status: "no" }, generation), false);
  assert.equal(await db.saveExtraction('facebook:123', { listings: [{ address: 'A' }, { address: 'B' }],
    extraction_model: 'test', extracted_at: 'now' }, generation), true);
  const posts = await db.readProcessingPosts();
  assert.equal(posts[0].extracted, 1);
  assert.deepEqual(Array.from(posts[0].listings, item => item.post_id), ['123_1', '123_2']);
  assert.equal(await db.saveExtraction('facebook:123', { listings: [{}] }, generation), false);
});

test('clear prevents in-flight model results from restoring data, including after recollection of the same post', async () => {
  const db = storage();
  const post = { id: 'facebook:123', raw_text: 'Room', rental_status: null, extracted: 0, listing_count: "uncertain" };
  await db.insertBatch([post]);
  const generation = await db.getGeneration();
  await db.clearAll();
  await db.insertBatch([post]);
  assert.equal(await db.saveClassification(post.id, { rental_status: "yes", listing_count: "single" }, generation), false);
  assert.equal((await db.readProcessingPosts())[0].rental_status, null);
});

test('version four upgrade preserves extracted units and their original post', async () => {
  const factory = new IDBFactory();
  await new Promise((resolve, reject) => {
    const request = factory.open('tro-collector', 4);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('raw-posts', { keyPath: 'id' }).add({ id: 'facebook:123', extracted: 1 });
      db.createObjectStore('images', { keyPath: 'id' });
      db.createObjectStore('metadata', { keyPath: 'key' });
      const oldKey = ['listing', 'id'].join('_');
      db.createObjectStore('listings', { keyPath: oldKey }).add({ [oldKey]: '123_1', post_id: '123', address: 'A' });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { request.result.close(); resolve(); };
  });
  const context = vm.createContext({ indexedDB: factory, IDBKeyRange });
  vm.runInContext(fs.readFileSync(`${__dirname}/../extension/storage.js`, 'utf8'), context);
  const [post] = await context.TroStorage.readProcessingPosts();
  assert.equal(post.listings[0].post_id, '123_1');
  assert.equal(post.listings[0].source_post_id, '123');
  assert.equal(post.listings[0].address, 'A');
  assert.equal(Object.keys(post.listings[0]).includes(['listing', 'id'].join('_')), false);
});

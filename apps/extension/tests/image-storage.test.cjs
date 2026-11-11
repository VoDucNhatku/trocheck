const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

const storageScript = fs.readFileSync(`${__dirname}/../extension/storage.js`, 'utf8');
function storage(factory) {
  const context = vm.createContext({ indexedDB: factory, IDBKeyRange });
  vm.runInContext(storageScript, context);
  return context.TroStorage;
}
const record = { id: 'facebook:123', text: 'Room', raw_text: 'Room', image_count: 2,
  images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'] };

async function createVersionThree(factory) {
  await new Promise((resolve, reject) => {
    const request = factory.open('tro-collector', 3);
    request.onupgradeneeded = () => request.result.createObjectStore('raw-posts', { keyPath: 'id' }).add(record);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { request.result.close(); resolve(); };
  });
}

test('version three migration separates image URLs and preserves post fields', async () => {
  const factory = new IDBFactory();
  await createVersionThree(factory);
  const store = storage(factory);
  const post = (await store.readPage()).posts[0];
  const images = await store.readImages('facebook:123');
  assert.equal(post.images, undefined);
  assert.equal(post.image_count, 2);
  assert.equal(post.raw_text, 'Room');
  assert.equal(images.length, 2);
  assert.equal(images[0].url, 'https://example.com/a.jpg');
  assert.equal(images[0].status, 'pending');
  assert.equal((await storage(factory).readImages('123')).length, 2);
});

test('images and raw post are committed together and duplicate posts do not change images', async () => {
  const store = storage(new IDBFactory());
  await store.insertBatch([record]);
  await store.insertBatch([{ ...record, images: ['https://example.com/other.jpg'] }]);
  assert.equal((await store.readPage()).posts[0].images, undefined);
  assert.equal((await store.readImages('123')).length, 2);
  assert.equal((await store.readImages('123'))[0].url, 'https://example.com/a.jpg');
});

test('clear invalidates in-flight writes even after a post with the same ID is collected again', async () => {
  const store = storage(new IDBFactory());
  await store.insertBatch([record]);
  const queued = await store.nextPendingImage();
  await store.clearAll();
  assert.equal((await store.readPage()).total, 0);
  assert.equal((await store.readImages('123')).length, 0);
  await assert.rejects(store.insertBatch([record], queued.generation), /cleared/);
  await store.insertBatch([record], await store.getGeneration());
  await store.finishImage(queued.image.id, queued.generation, new Blob(['old'], { type: 'image/png' }));
  assert.equal((await store.readImages('123'))[0].status, 'pending');
  const current = await store.nextPendingImage();
  await store.finishImage(current.image.id, current.generation, new Blob(['new'], { type: 'image/png' }));
  const image = (await store.readImages('123'))[0];
  assert.equal(image.status, 'downloaded');
  assert.equal(await image.data.text(), 'new');
});

test('failed downloads keep the URL and stop after three attempts', async () => {
  const store = storage(new IDBFactory());
  await store.insertBatch([{ ...record, images: [record.images[0]] }]);
  const generation = await store.getGeneration();
  for (let i = 0; i < 3; i++) await store.finishImage('image_123_1', generation, null);
  const image = (await store.readImages('123'))[0];
  assert.equal(image.url, record.images[0]);
  assert.equal(image.attempts, 3);
  assert.equal(image.status, 'failed');
  assert.equal(await store.nextPendingImage(), null);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

const read = name => fs.readFileSync(`${__dirname}/../extension/${name}`, 'utf8');
function load(factory = new IDBFactory()) {
  const context = vm.createContext({ indexedDB: factory, IDBKeyRange, URL, Blob, fetch: () => { throw new Error('unexpected network'); } });
  context.globalThis = context;
  for (const name of ['privacy.js', 'storage.js', 'trocheck.js']) vm.runInContext(read(name), context);
  return context;
}

const record = (id, images) => ({ id: `facebook:${id}`, postUrl: `https://www.facebook.com/groups/42/posts/${id}/`,
  text: 'Phòng 25m2, giá 3tr', raw_text: 'Group: Phòng trọ\n\nPhòng 25m2, giá 3tr', text_status: 'expanded', images });

test('only downloaded photos of posts the store accepted wait for upload', async () => {
  const { TroStorage } = load();
  await TroStorage.insertBatch([record('1', ['https://x/a.jpg', 'https://x/b.jpg']), record('2', ['https://x/c.jpg'])]);
  const generation = await TroStorage.getGeneration();
  await TroStorage.finishImage('image_1_1', generation, new Blob(['a'], { type: 'image/jpeg' }));
  await TroStorage.finishImage('image_2_1', generation, new Blob(['c'], { type: 'image/jpeg' }));
  assert.equal((await TroStorage.readImagesToUpload()).length, 0, 'nothing before the posts are sent');
  await TroStorage.markSent([{ id: 'facebook:1', status: 'created' }, { id: 'facebook:2', status: 'rejected' }]);
  const pending = await TroStorage.readImagesToUpload();
  assert.deepEqual(pending.map(item => item.image.id), ['image_1_1'], 'pending download and rejected post are left out');
  assert.equal(pending[0].record.id, 'facebook:1');
  await TroStorage.markImageUploaded('image_1_1', 'created');
  assert.equal((await TroStorage.readImagesToUpload()).length, 0);
});

test('photos go to the store once, refused files are not retried, and a missing setup stops early', async () => {
  const { TroCheck } = load();
  const marked = [];
  const item = (id, n) => ({ image: { id, data: new Blob([String(n)], { type: 'image/jpeg' }) }, record: record(n, []) });
  const storage = { readImagesToUpload: async () => [item('i1', 1), item('i2', 2), item('i3', 3), item('i4', 4)],
    markImageUploaded: async (id, status) => marked.push([id, status]) };
  const answers = { 1: [200, 'created'], 2: [200, 'duplicate'], 3: [415], 4: [404] };
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push(url);
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers.Authorization, 'Bearer abc');
    assert.equal(options.headers['Content-Type'], 'image/jpeg');
    const key = decodeURIComponent(url.split('idempotency_key=')[1]);
    const [status, body] = answers[key.split(':')[2]];
    return { ok: status === 200, status, json: async () => ({ status: body }) };
  };
  const result = await TroCheck.sendImages({ storage, apiUrl: 'http://127.0.0.1:8000/api/v1', token: 'abc', fetcher });
  assert.ok(calls.every(url => url.startsWith('http://127.0.0.1:8000/api/v1/ingest/images?idempotency_key=fb%3A42%3A')));
  assert.deepEqual({ ...result }, { uploaded: 1, duplicate: 1, skipped: 2, total: 4 });
  assert.deepEqual(marked, [['i1', 'created'], ['i2', 'duplicate'], ['i3', 'skipped']], 'the 404 photo stays pending');

  const off = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(TroCheck.sendImages({ storage, apiUrl: '', token: 'abc', fetcher: off }), /chưa bật lưu ảnh/);
});

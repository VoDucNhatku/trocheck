const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

const extension = path.join(__dirname, '..', 'extension');
const script = file => fs.readFileSync(path.join(extension, file), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function until(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return;
    await tick();
  }
  throw new Error('Dashboard did not reach the expected state');
}

function setup(t, posts) {
  const dom = new JSDOM(script('dashboard.html'), { runScripts: 'outside-only', url: 'https://extension.invalid/' });
  t.after(() => dom.window.close());
  const settings = { typesafeApiKey: 'private-key', ollamaApiKey: 'ollama-key', ollamaExtractionModel: 'model' };
  let generation = 0;
  dom.window.chrome = { storage: { local: {
    get: async () => ({ ...settings }),
    set: async data => Object.assign(settings, data),
  } } };
  dom.window.confirm = () => true;
  dom.window.TroStorage = {
    readPage: async () => ({ posts, total: posts.length, next: null }),
    readProcessingPosts: async () => posts,
    getGeneration: async () => generation,
    saveClassification: async (id, result, expected) => {
      if (expected !== generation) return false;
      Object.assign(posts.find(post => post.id === id), result);
      return true;
    },
    saveUnknownDecision: async (id, result, expected) => {
      if (expected !== generation) return false;
      Object.assign(posts.find(post => post.id === id), result);
      return true;
    },
    saveExtraction: async (id, result, expected) => {
      if (expected !== generation) return false;
      Object.assign(posts.find(post => post.id === id), result, { extracted: 1 });
      return true;
    },
    clearAll: async () => { generation++; posts.length = 0; },
  };
  dom.window.eval(script('dashboard.js'));
  return { dom, settings };
}

test('processing counts eligible posts, skips unknown listing counts and renders each listing', async t => {
  const posts = [
    { id: 'facebook:1', rental_status: "yes", extracted: 0, listing_count: "multiple", raw_text: 'Two rooms', image_count: 0 },
    { id: 'facebook:2', rental_status: "yes", extracted: 0, listing_count: "uncertain", raw_text: 'Unknown', image_count: 0 },
    { id: 'facebook:3', rental_status: "no", extracted: 0, raw_text: 'Irrelevant', image_count: 0 },
  ];
  const { dom } = setup(t, posts);
  let calls = 0;
  dom.window.TroProcessing = { extract: async () => {
    calls++;
    return { listings: [{ post_id: '1_1', address: 'A' }, { post_id: '1_2', address: 'B' }], extraction_model: 'provider/extract' };
  } };
  dom.window.document.querySelector('[data-page="process"]').click();
  await until(() => dom.window.document.querySelector('#counts').textContent.includes('Chờ trích xuất: 2'));
  dom.window.document.querySelector('#extract').click();
  await until(() => dom.window.document.querySelector('#process-status').textContent.includes('1 thành công, 1 lỗi'));
  await until(() => dom.window.document.querySelectorAll('#processed-records tbody tr').length === 4);
  assert.equal(calls, 1);
  assert.equal(posts[1].extracted, 0);
  assert.match(dom.window.document.querySelector('#processed-records').textContent, /1_1/);
  assert.match(dom.window.document.querySelector('#processed-records').textContent, /1_2/);
});

test('retry unknown count reclassifies only unresolved eligible posts', async t => {
  const posts = [
    { id: 'facebook:1', rental_status: "yes", extracted: 0, listing_count: "uncertain", raw_text: 'Room', image_count: 0 },
    { id: 'facebook:2', rental_status: "yes", extracted: 0, listing_count: "single", raw_text: 'Other room', image_count: 0 },
    { id: 'facebook:3', rental_status: null, extracted: 0, listing_count: "uncertain", raw_text: 'New', image_count: 0 },
  ];
  const { dom } = setup(t, posts);
  let calls = 0;
  dom.window.TroProcessing = { classifyJev: async () => { calls++; return { rental_status: "yes", listing_count: "multiple" }; } };
  dom.window.document.querySelector('[data-page="process"]').click();
  await until(() => dom.window.document.querySelector('#counts').textContent.includes('Chưa rõ số căn: 1'));
  dom.window.document.querySelector('#retry-unknown').click();
  await until(() => dom.window.document.querySelector('#process-status').textContent.includes('1 thành công, 0 lỗi'));
  assert.equal(calls, 1);
  assert.equal(posts[0].listing_count, "multiple");
  assert.equal(posts[2].rental_status, null);
});

test('clearing data aborts an active request and keeps private settings', async t => {
  const posts = [{ id: 'facebook:1', rental_status: null, extracted: 0, raw_text: 'Room', image_count: 0 }];
  const { dom, settings } = setup(t, posts);
  let started = false;
  dom.window.TroProcessing = { classifyJev: ({ signal }) => new Promise((resolve, reject) => {
    started = true;
    signal.addEventListener('abort', () => reject(new Error('cancelled')));
  }) };
  dom.window.document.querySelector('[data-page="process"]').click();
  await until(() => dom.window.document.querySelector('#counts').textContent.includes('Chưa lọc: 1'));
  dom.window.document.querySelector('#classify').click();
  await until(() => started);
  dom.window.document.querySelector('[data-page="settings"]').click();
  await until(() => dom.window.document.querySelector('#typesafe-api-key').placeholder.includes('Đã lưu key'));
  assert.equal(dom.window.document.querySelector('#typesafe-api-key').value, '');
  dom.window.document.querySelector('#clear').click();
  await until(() => dom.window.document.querySelector('#clear-status').textContent.includes('Đã xóa'));
  await until(() => dom.window.document.querySelector('#process-status').textContent.includes('Đã dừng'));
  assert.equal(posts.length, 0);
  assert.equal(settings.typesafeApiKey, 'private-key');
});

test('dashboard connects TypeSafe and Ollama responses to persistent classification and multiple listings', async t => {
  const dom = new JSDOM(script('dashboard.html'), { runScripts: 'outside-only', url: 'https://extension.invalid/' });
  t.after(() => dom.window.close());
  Object.defineProperty(dom.window, 'indexedDB', { value: new IDBFactory() });
  dom.window.IDBKeyRange = IDBKeyRange;
  dom.window.chrome = { storage: { local: { get: async () => ({ typesafeApiKey: 'key', ollamaApiKey: 'ollama-key', ollamaExtractionModel: 'extraction' }) } } };
  let calls = 0;
  dom.window.fetch = async () => {
    calls++;
    const response = calls === 1
      ? { answers: { listing: { type: 'noul', noul: 0.9 }, price: { type: 'noul', noul: 0.8 }, count: { type: 'choice', choice: 'multiple', probabilities: {single: 0.05, multiple: 0.9, unknown: 0.05}, confidence: 0.85 } } }
      : { listings: ['A', 'B'].map(address => ({ property_type: null, address, ward: null, district: null,
        city: null, rent_price: '3 triệu', area: null, contact: null, additional_info: null })) };
    return { ok: true, json: async () => calls === 1 ? response : ({ choices: [{ message: { content: JSON.stringify(response) } }] }) };
  };
  dom.window.eval(script('storage.js'));
  dom.window.eval(script('privacy.js'));
  dom.window.eval(script('trocheck.js'));
  dom.window.eval(script('processing.js'));
  await dom.window.TroStorage.insertBatch([{ id: 'facebook:123', postUrl: 'https://www.facebook.com/groups/42/posts/123/',
    raw_text: 'Two rooms', rental_status: null, extracted: 0, listing_count: "uncertain", image_count: 0 }]);
  dom.window.eval(script('dashboard.js'));
  dom.window.document.querySelector('[data-page="process"]').click();
  await until(() => dom.window.document.querySelector('#counts').textContent.includes('Chưa lọc: 1'));
  dom.window.document.querySelector('#classify').click();
  await until(() => dom.window.document.querySelector('#counts').textContent.includes('Chờ trích xuất: 1'));
  dom.window.document.querySelector('#extract').click();
  await until(() => dom.window.document.querySelectorAll('#processed-records tbody tr').length === 2);
  const [post] = await dom.window.TroStorage.readProcessingPosts();
  assert.equal(post.extracted, 1);
  assert.deepEqual(Array.from(post.listings, item => item.post_id), ['123_1', '123_2']);
  assert.equal(calls, 2);
});

test('settings keep Ollama configuration without reusing the old OpenRouter key or model', async t => {
  const { dom, settings } = setup(t, []);
  dom.window.eval(script('privacy.js'));
  dom.window.eval(script('trocheck.js'));
  dom.window.eval(script('processing.js'));
  delete settings.typesafeApiKey;
  delete settings.ollamaExtractionModel;
  settings.apiKey = 'old-openrouter-key';
  settings.extractionProvider = 'ollama';
  settings.extractionModel = 'gemma:cloud';
  dom.window.document.querySelector('[data-page="settings"]').click();
  await until(() => dom.window.document.querySelector('#extraction-model').value === 'gemma:cloud');
  assert.match(dom.window.document.querySelector('#typesafe-api-key').placeholder, /Nhập TypeSafe/);
  dom.window.document.querySelector('#typesafe-api-key').value = 'typesafe-key';
  dom.window.document.querySelector('#settings-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => dom.window.document.querySelector('#settings-status').textContent === 'Đã lưu cài đặt.');
  assert.equal(settings.typesafeApiKey, 'typesafe-key');
  assert.equal(settings.ollamaExtractionModel, 'gemma:cloud');
  assert.equal(settings.apiKey, 'old-openrouter-key');
});

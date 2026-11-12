const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function load() {
  const context = vm.createContext({ URL, fetch: () => { throw new Error('unexpected network'); } });
  context.globalThis = context;
  for (const name of ['privacy.js', 'trocheck.js']) vm.runInContext(fs.readFileSync(`${__dirname}/../extension/${name}`, 'utf8'), context);
  return context;
}

const record = (id, extra = {}) => ({
  id: `facebook:${id}`, postUrl: `https://www.facebook.com/groups/42/posts/${id}/`,
  text: 'Phòng 25m2, giá 3tr. Liên hệ 0123 456 789', raw_text: 'Group: Phòng trọ\n\nPhòng 25m2, giá 3tr. Liên hệ 0123 456 789',
  text_status: 'expanded', ...extra,
});

test('phone numbers in the usual Vietnamese forms are masked', () => {
  const { TroPrivacy } = load();
  for (const phone of ['0123456789', '0123 456 789', '0123.456.789', '0123-456-789', '+84 123456789']) {
    assert.equal(TroPrivacy.maskPhones(`LH ${phone} nhé`), 'LH [SĐT] nhé');
  }
  assert.equal(TroPrivacy.maskPhones('Giá 4.700.000 đ, cọc 1 tháng'), 'Giá 4.700.000 đ, cọc 1 tháng');
});

test('a Marketplace listing is sent with the group it was shared in', () => {
  const { TroCheck } = load();
  const post = TroCheck.toIngestPost(record('77001', { postUrl: 'https://www.facebook.com/marketplace/item/77001/', group_id: '888' }));
  assert.equal(post.idempotency_key, 'fb:888:77001');
  assert.equal(post.source_group_id, '888');
  assert.equal(post.permalink, 'https://www.facebook.com/marketplace/item/77001/');
});

test('a saved record becomes a post that matches the ingest schema', () => {
  const { TroCheck } = load();
  const post = JSON.parse(JSON.stringify(TroCheck.toIngestPost(record('7'))));
  assert.deepEqual(post, {
    idempotency_key: 'fb:42:7', source_type: 'facebook_group',
    permalink: 'https://www.facebook.com/groups/42/posts/7/', external_post_id: '7',
    source_group_id: '42', source_group_name: 'Phòng trọ',
    text: 'Phòng 25m2, giá 3tr. Liên hệ [SĐT]', text_complete: true, phone_masked: true,
  });
  assert.equal(TroCheck.toIngestPost(record('8', { text_status: 'visible' })).text_complete, false);
  assert.equal(TroCheck.toIngestPost(record('9', { text_status: undefined })).text_complete, false);
});

test('only the TrọCheck API and local addresses are accepted', () => {
  const { TroCheck } = load();
  assert.equal(TroCheck.normalizeApiUrl(''), TroCheck.DEFAULT_API_URL);
  assert.equal(TroCheck.normalizeApiUrl('http://127.0.0.1:8000/api/v1/'), 'http://127.0.0.1:8000/api/v1');
  assert.throws(() => TroCheck.normalizeApiUrl('https://example.com/api/v1'));
  assert.throws(() => TroCheck.normalizeApiUrl('http://trocheck-api.onrender.com/api/v1'));
});

test('unsent posts go out in batches and each answered post is marked', async () => {
  const { TroCheck } = load();
  const saved = Array.from({ length: 25 }, (_, i) => record(String(i + 1)));
  const marked = [];
  const sizes = [];
  const fetcher = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8000/api/v1/ingest/batch');
    assert.equal(options.headers.Authorization, 'Bearer abc');
    const { client, posts } = JSON.parse(options.body);
    assert.equal(client.extension_version, '0.2.0');
    assert.match(client.session_id, /^s-\d{14}$/);
    sizes.push(posts.length);
    assert.ok(posts.every(post => !post.text.includes("0123")));
    return { ok: true, json: async () => ({
      results: posts.map(post => ({ idempotency_key: post.idempotency_key, status: 'created' })),
      summary: { created: posts.length, duplicate: 0, rejected: 0 },
    }) };
  };
  const storage = { readUnsent: async () => saved, markSent: async items => marked.push(...items) };
  const result = await TroCheck.sendUnsent({ storage, apiUrl: 'http://127.0.0.1:8000/api/v1/', token: ' abc ', version: '0.2.0', fetcher });
  assert.deepEqual([...sizes], [20, 5]);
  assert.equal(result.created, 25);
  assert.equal(marked.length, 25);
});

test('a rejected token stops sending and leaves posts unsent', async () => {
  const { TroCheck } = load();
  const marked = [];
  const storage = { readUnsent: async () => [record('1')], markSent: async items => marked.push(...items) };
  await assert.rejects(
    TroCheck.sendUnsent({ storage, apiUrl: '', token: 'bad', version: '0.2.0', fetcher: async () => ({ ok: false, status: 401 }) }),
    /Mã kết nối sai.*Kết nối lại/,
  );
  assert.equal(marked.length, 0);
  await assert.rejects(TroCheck.sendUnsent({ storage, apiUrl: '', token: '', version: '0.2.0' }), /Chưa kết nối/);
});

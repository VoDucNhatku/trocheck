const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
const { collectPosts } = require('../extension/collector.js');

const script = name => fs.readFileSync(`${__dirname}/../extension/${name}`, 'utf8');
const post = (id = '123', overrides = {}) => ({
  postId: id, postUrl: `https://www.facebook.com/groups/42/posts/${id}/`,
  text: 'A room', images: ['https://example.com/room.jpg'], textStatus: 'expanded',
  imageStatus: 'visible-only', linkSource: 'permalink', ...overrides,
});
function background(factory = new IDBFactory()) {
  let listener;
  const context = vm.createContext({
    indexedDB: factory, IDBKeyRange, URL, console: { error() {} },
    chrome: { runtime: { id: 'extension', onMessage: { addListener(fn) { listener = fn; } } } },
  });
  context.importScripts = name => vm.runInContext(script(name), context);
  vm.runInContext(script('background.js'), context);
  const sender = { id: 'extension', url: 'https://www.facebook.com/groups/42/', tab: { id: 1 } };
  return {
    context,
    send: (posts, override = {}) => new Promise(resolve => {
      const result = listener({ type: 'SAVE_RAW_POSTS', posts }, { ...sender, ...override }, resolve);
      if (result !== true) resolve(undefined);
    }),
    read: options => context.TroStorage.readPage(options),
  };
}

test('a Marketplace listing is stored with the group it was shared in', async () => {
  const worker = background(new IDBFactory());
  const listing = post('77001', { postUrl: 'https://www.facebook.com/marketplace/item/77001/', linkSource: 'marketplace', groupId: '888' });
  assert.equal((await worker.send([listing])).saved, 1);
  const saved = (await worker.read()).posts[0];
  assert.equal(saved.postUrl, 'https://www.facebook.com/marketplace/item/77001/');
  assert.equal(saved.group_id, '888');
  const mismatched = post('77002', { postUrl: 'https://www.facebook.com/marketplace/item/99999/', linkSource: 'marketplace' });
  assert.equal((await worker.send([mismatched])).ok, false);
});

test('saved records survive restart and ignore later duplicates', async () => {
  const factory = new IDBFactory();
  const first = background(factory);
  assert.equal((await first.send([post()])).saved, 1);
  const original = (await first.read()).posts[0];
  assert.equal(original.raw_text, 'A room');
  assert.equal(original.rental_status, null);
  assert.equal(original.extracted, 0);
  assert.equal(original.listing_count, null);
  assert.equal(original.image_count, 1);
  const restarted = background(factory);
  const response = await restarted.send([post('123', { text: 'Updated rent', textStatus: 'visible' })]);
  assert.equal(response.saved, 0);
  assert.equal(response.duplicates, 1);
  const page = await restarted.read();
  assert.equal(page.total, 1);
  assert.equal(page.posts[0].text, 'A room');
  assert.equal(page.posts[0].time, original.time);
});

test('a duplicate can fill missing group context only when its text is unchanged', async () => {
  const bg = background();
  await bg.send([post()]);
  await bg.send([post('123', { raw_text: 'Group: Room group\n\nA room' })]);
  const enriched = (await bg.read()).posts[0];
  assert.equal(enriched.raw_text, 'Group: Room group\n\nA room');
  await bg.send([post('123', { text: 'Changed text', raw_text: 'Group: Other\n\nChanged text' })]);
  assert.equal((await bg.read()).posts[0].raw_text, enriched.raw_text);
  await bg.send([post('456')]);
  await bg.send([post('456', { text: 'Changed text', raw_text: 'Group: Other\n\nChanged text' })]);
  assert.equal((await bg.read()).posts.find(p => p.id === 'facebook:456').raw_text, 'A room');
});

test('partial stays out of storage until a later expanded or visible record arrives', async () => {
  const bg = background();
  const response = await bg.send([post('123', { text: 'Short...', textStatus: 'partial' })]);
  assert.equal(response.partial, 1);
  assert.equal(response.saved, 0);
  assert.equal((await bg.read()).total, 0);
  await bg.send([post('123', { text: 'Full text' }), post('456', { textStatus: 'visible' })]);
  const page = await bg.read();
  assert.equal(page.total, 2);
  assert.equal(page.posts[0].text, 'Full text');
});

test('concurrent tabs and repeated IDs insert only the first eligible record', async () => {
  const bg = background();
  const replies = await Promise.all([
    bg.send([post()]),
    bg.send([post()], { tab: { id: 2 } }),
  ]);
  assert.equal(replies.reduce((sum, r) => sum + r.saved, 0), 1);
  const response = await bg.send([post('456'), post('456', { text: 'Different text' })]);
  assert.equal(response.saved, 1);
  assert.equal(response.duplicates, 1);
  assert.equal((await bg.read()).total, 2);
});

test('validation rejects a whole malformed batch and unauthorized senders', async () => {
  const bg = background();
  assert.equal((await bg.send([post(), post('456', { postUrl: 'https://evil.example/' })])).ok, false);
  assert.equal((await bg.read()).total, 0);
  assert.equal(await bg.send([post()], { id: 'other' }), undefined);
  assert.equal((await bg.send([post()], { url: 'https://evil.example/' })).ok, false);
});

test('failed batch aborts earlier inserts and returns an explicit error', async () => {
  const bg = background();
  await assert.rejects(bg.context.TroStorage.insertBatch([
    { id: 'facebook:123', text: 'First' }, { text: 'Missing primary key' },
  ]));
  assert.equal((await bg.read()).total, 0);
  bg.context.TroStorage.insertBatch = async () => { throw new Error('Quota exceeded'); };
  const response = await bg.send([post()]);
  assert.equal(response.ok, false);
  assert.match(response.error, /Quota/);
});

test('cursor pagination reads each record once without loading all records', async () => {
  const bg = background();
  await bg.send([post('100'), post('200'), post('300')]);
  const first = await bg.read({ limit: 2 });
  assert.equal(first.total, 3);
  assert.equal(first.next, 'facebook:200');
  const second = await bg.read({ limit: 2, after: first.next });
  assert.equal(second.posts.length, 1);
  assert.equal(second.posts[0].id, 'facebook:300');
  assert.equal(second.next, null);
});

test('dashboard reads persisted pages, safely renders raw text and refreshes', async t => {
  const bg = background();
  await bg.send([post('123', { text: '<img src=x onerror=alert(1)>' })]);
  const dom = new JSDOM(script('dashboard.html'), { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  let loaded;
  dom.window.TroStorage = { readPage: async options => {
    const page = await bg.read(options);
    loaded?.();
    return page;
  } };
  let ready = new Promise(resolve => { loaded = resolve; });
  dom.window.eval(script('privacy.js'));
  dom.window.eval(script('trocheck.js'));
  dom.window.eval(script('dashboard.js'));
  await ready;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(dom.window.document.querySelectorAll('tbody tr').length, 1);
  assert.equal(dom.window.document.querySelector('tbody img'), null);
  assert.match(dom.window.document.querySelector('tbody').textContent, /<img src=x onerror=alert\(1\)>/);
  await bg.send([post('456')]);
  ready = new Promise(resolve => { loaded = resolve; });
  dom.window.document.querySelector('#refresh').click();
  await ready;
  await new Promise(resolve => setImmediate(resolve));
  assert.match(dom.window.document.querySelector('#status').textContent, /Đã lưu 2 bài/);
});

test('collector output flows through background into the dashboard table', async t => {
  const source = new JSDOM('<h1>Room group</h1><div role="feed"><div><span data-ad-rendering-role="profile_name">Author</span><a href="/groups/42/posts/123/">Time</a><div data-ad-rendering-role="story_message">Room for rent</div></div></div>', { url: 'https://www.facebook.com/groups/42/' });
  t.after(() => source.window.close());
  const posts = collectPosts(source.window.document);
  assert.equal(posts.length, 1);
  const bg = background();
  assert.equal((await bg.send(posts)).saved, 1);
  const saved = (await bg.read()).posts[0];
  assert.equal(saved.raw_text, 'Group: Room group\n\nRoom for rent');
  const dom = new JSDOM(script('dashboard.html'), { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.TroStorage = { readPage: options => bg.read(options) };
  dom.window.eval(script('privacy.js'));
  dom.window.eval(script('trocheck.js'));
  dom.window.eval(script('dashboard.js'));
  await new Promise(resolve => setTimeout(resolve, 20));
  const cells = [...dom.window.document.querySelectorAll('tbody td')].map(cell => cell.textContent);
  assert.deepEqual(cells.slice(0, 2), ['123', 'Group: Room group\n\nRoom for rent']);
  assert.deepEqual(cells.slice(3), ['', '0', '—', '0']);
});

test('version two migration preserves raw records and initializes new fields', async () => {
  const factory = new IDBFactory();
  await new Promise((resolve, reject) => {
    const request = factory.open('tro-collector', 2);
    request.onupgradeneeded = () => request.result.createObjectStore('raw-posts', { keyPath: 'id' }).add({
      id: 'facebook:123', postUrl: 'https://www.facebook.com/groups/42/posts/123/',
      text: 'Existing post', images: ['https://example.com/a.jpg'], time: 'old time',
    });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { request.result.close(); resolve(); };
  });
  const bg = background(factory);
  const record = (await bg.read()).posts[0];
  assert.equal(record.raw_text, 'Existing post');
  assert.equal(record.time, 'old time');
  assert.equal(record.images, undefined);
  assert.equal((await bg.context.TroStorage.readImages('123'))[0].url, 'https://example.com/a.jpg');
  assert.equal(record.image_count, 1);
  assert.equal(record.rental_status, null);
  assert.equal(record.extracted, 0);
  assert.equal(record.listing_count, null);
});

test('content script awaits persistence acknowledgment and retries after a failed write', async t => {
  const dom = new JSDOM('<main></main>', { url: 'https://www.facebook.com/groups/42/', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  let callback;
  let attempts = 0;
  dom.window.TroCollector = { observePosts(options) { callback = options.onPosts; return { stop() {}, flush() {} }; } };
  dom.window.chrome = { runtime: { sendMessage: async message => {
    assert.equal(message.type, 'SAVE_RAW_POSTS');
    attempts++;
    return attempts === 1 ? { ok: false, error: 'Write failed' } : { ok: true, saved: 1 };
  } } };
  dom.window.console.info = () => {};
  dom.window.eval(script('privacy.js'));
  dom.window.eval(script('content-script.js'));
  await assert.rejects(callback([post()]), /Write failed/);
  await callback([post()]);
  assert.equal(attempts, 2);
  assert.equal(dom.window.troCollector.snapshot().length, 1);
});

test('version one migration copies eligible records and preserves legacy data', async () => {
  const factory = new IDBFactory();
  await new Promise((resolve, reject) => {
    const request = factory.open('tro-collector', 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('posts', { keyPath: 'id' });
      for (const [id, textStatus] of [['123', 'expanded'], ['456', 'partial'], ['789', 'visible']]) {
        store.add({ ...post(id, { textStatus }), id: `facebook:${id}`, firstSeenAt: '2026-10-18T08:00:00.000Z' });
      }
    };
    request.onsuccess = () => { request.result.close(); resolve(); };
  });
  const page = await background(factory).read();
  assert.equal(page.total, 2);
  assert.equal(page.posts[0].raw_text, 'A room');
  assert.equal(page.posts[0].image_count, 1);
  assert.equal(page.posts[0].time, '2026-10-18T08:00:00.000Z');
  await new Promise((resolve, reject) => {
    const request = factory.open('tro-collector', 5);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('posts');
      transaction.objectStore('posts').count().onsuccess = event => assert.equal(event.target.result, 3);
      transaction.oncomplete = () => { db.close(); resolve(); };
    };
  });
});

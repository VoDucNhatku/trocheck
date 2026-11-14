const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');
const script = name => fs.readFileSync(`${__dirname}/../extension/${name}`, 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(check) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  throw new Error('Expected background state was not reached');
}
const rawPost = (id = '123', images = []) => ({ postId: id, postUrl: `https://www.facebook.com/groups/42/posts/${id}/`,
  text: 'Phòng trọ 0901234567', images, textStatus: 'visible', imageStatus: 'visible-only', linkSource: 'permalink' });
const localStore = values => ({
  get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, values[key]])),
  set: async data => Object.assign(values, data),
  remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; },
});
function worker({ config = {}, fetcher, factory = new IDBFactory(), session = {} } = {}) {
  let listener, alarm, onUpdated;
  const alarms = new Map();
  const badges = new Map();
  const tab = { id: 1, url: 'https://www.facebook.com/groups/42/' };
  const context = vm.createContext({ indexedDB: factory, IDBKeyRange, URL, Blob, AbortController, setTimeout, clearTimeout,
    console: { error() {} }, fetch: fetcher || (async () => { throw new Error('No network expected'); }),
    chrome: { runtime: { id: 'extension', getURL: path => `chrome-extension://extension/${path}`, getManifest: () => ({ version: '0.3.1' }),
      onMessage: { addListener(fn) { listener = fn; } } },
      storage: { local: localStore(config), session: localStore(session) },
      tabs: { get: async () => tab, query: async () => [tab], onUpdated: { addListener(fn) { onUpdated = fn; } } },
      action: { setBadgeText: async ({ tabId, text }) => badges.set(tabId, text), setTitle: async () => {} },
      alarms: { create: async (name, options) => alarms.set(name, { ...options, scheduledTime: options.when }),
        get: async name => alarms.get(name), clear: async name => alarms.delete(name), onAlarm: { addListener(fn) { alarm = fn; } } },
    },
  });
  context.importScripts = name => vm.runInContext(script(name), context);
  vm.runInContext(script('background.js'), context);
  const sender = { id: 'extension', url: tab.url, tab: { id: 1 } };
  const send = (message, override = sender) => new Promise(resolve => {
    if (listener(message, override, resolve) !== true) resolve(undefined);
  });
  return { context, config, alarms, badges, tab, send, alarm: name => alarm({ name }),
    update: url => { tab.url = url; onUpdated(1, { url }, tab); },
    internal: message => send(message, { id: 'extension', url: 'chrome-extension://extension/dashboard.html' }),
    save: (posts = [rawPost()], override) => send({ type: 'SAVE_RAW_POSTS', posts }, override || sender),
  };
}
const connected = () => ({ trocheckToken: 'fake-token', trocheckApiUrl: 'http://127.0.0.1:8000/api/v1', trocheckAccount: 'tester' });
const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const ingestAnswer = options => {
  const posts = JSON.parse(options.body).posts;
  return json({ results: posts.map(post => ({ idempotency_key: post.idempotency_key, status: 'created' })), summary: { created: posts.length } });
};

test('client-side navigation starts and stops collection without leaking unsupported posts or partial text', async t => {
  const dom = new JSDOM('<main></main>', { url: 'https://www.facebook.com/', runScripts: 'outside-only' });
  const win = dom.window;
  t.after(() => { win.troCollector.stop(); win.close(); });
  let starts = 0, stops = 0, onPosts, shadow;
  const attachShadow = win.Element.prototype.attachShadow;
  win.Element.prototype.attachShadow = function (options) { shadow = attachShadow.call(this, options); return shadow; };
  const messages = [];
  win.chrome = { runtime: { sendMessage: async message => { messages.push(message); return { ok: true, saved: message.type === 'SAVE_RAW_POSTS' ? 1 : 0 }; } } };
  win.TroCollector = { observePosts(options) { starts++; onPosts = options.onPosts; return { stop() { stops++; }, flush() {} }; } };
  win.console.info = () => {};
  win.eval(script('privacy.js')); win.eval(script('content-script.js'));
  assert.equal(starts, 0);
  assert.equal(win.document.querySelector('#trocheck-status'), null);
  win.history.pushState({}, '', '/groups/42/');
  await until(() => starts === 1);
  assert.ok(win.document.querySelector('#trocheck-status'));
  assert.equal(win.document.querySelector('#trocheck-status').shadowRoot, null, 'Facebook cannot style the closed shadow contents');
  await onPosts([rawPost('1', []), { ...rawPost('2'), textStatus: 'partial' }]);
  const saved = messages.filter(message => message.type === 'SAVE_RAW_POSTS');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].posts.length, 1);
  assert.equal(saved[0].posts[0].text.includes('0901234567'), false);
  assert.equal(win.troCollector.snapshot().length, 1);
  assert.equal(shadow.querySelector('[role="status"]').textContent, 'TrọCheck đang lưu · 1 bài mới');
  shadow.querySelector('button').click();
  assert.equal(win.document.querySelector('#trocheck-status'), null);
  win.history.pushState({}, '', '/');
  await onPosts([rawPost('3')]);
  await until(() => stops === 1);
  assert.equal(messages.filter(message => message.type === 'SAVE_RAW_POSTS').length, 1);
  assert.equal(win.document.querySelector('#trocheck-status'), null);
  win.history.pushState({}, '', '/profile.php?id=42');
  await win.troCollector.flush();
  assert.equal(starts, 1);
  win.history.pushState({}, '', '/search/posts/?q=room');
  await win.troCollector.flush();
  assert.equal(starts, 2);
  assert.equal(win.document.querySelector('#trocheck-status'), null, 'dismissal survives supported navigation during the session');
});

test('background refuses unsupported senders, spoofed page paths, and navigation during delivery', async () => {
  const bg = worker();
  const group = bg.tab.url;
  for (const path of ['/', '/profile.php?id=1', '/somepage/', '/marketplace/', '/messages/']) {
    bg.tab.url = `https://www.facebook.com${path}`;
    assert.equal((await bg.save([rawPost()], { id: 'extension', tab: { id: 1 }, url: `https://www.facebook.com${path}` })).ok, false);
    assert.equal((await bg.save([rawPost()], { id: 'extension', tab: { id: 1 }, url: group })).ok, false, 'a document loaded in a group but now elsewhere');
  }
  assert.equal((await bg.save([rawPost()], { id: 'extension', tab: { id: 1 }, url: 'https://evil.example/groups/1/' })).ok, false);
  bg.tab.url = group;
  assert.equal((await bg.send({ type: 'SAVE_RAW_POSTS', pageUrl: 'https://www.facebook.com/', posts: [rawPost()] })).ok, false);
  bg.tab.url = 'https://www.facebook.com/';
  assert.equal((await bg.save()).ok, false);
  assert.equal((await bg.context.TroStorage.readPage()).total, 0);
});

test('a document loaded on the home feed saves posts once the tab has moved into a group', async () => {
  // Chrome reports the load-time address in sender.url after history.pushState; the tab URL is the current one.
  const bg = worker();
  const answer = await bg.save([rawPost()], { id: 'extension', tab: { id: 1 }, url: 'https://www.facebook.com/' });
  assert.equal(answer.ok, true);
  assert.equal(answer.saved, 1);
});

test('web hand-off ignores wrong origin/source and returns only non-secret connection results', async t => {
  const dom = new JSDOM('', { url: 'https://trocheck.vercel.app/tai-khoan', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const win = dom.window;
  const calls = [], answers = [];
  win.chrome = { runtime: { sendMessage: async message => { calls.push(message); return { ok: true, account: 'tester' }; } } };
  win.postMessage = (message, origin) => answers.push({ message, origin });
  win.eval(script('web-connect.js'));
  const data = { source: 'trocheck-web', type: 'CONNECT', requestId: 'a', token: 'fake-token', apiUrl: 'https://attacker.invalid' };
  const emit = (origin, source = win, payload = data) => win.dispatchEvent(new win.MessageEvent('message', { origin, source, data: payload }));
  emit('https://attacker.invalid'); emit('http://localhost:3000'); emit(win.location.origin, null);
  await tick(); assert.equal(calls.length, 0);
  emit(win.location.origin, win, { ...data, type: 'PING' }); await tick();
  assert.equal(answers[0].message.type, 'PONG');
  emit(win.location.origin); await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].apiUrl, undefined);
  assert.equal(calls[0].origin, win.location.origin);
  assert.equal(answers[1].origin, win.location.origin);
  assert.equal(JSON.stringify(answers).includes('fake-token'), false);
  const disallowed = new JSDOM('', { url: 'https://attacker.invalid', runScripts: 'outside-only' });
  t.after(() => disallowed.window.close());
  disallowed.window.chrome = win.chrome;
  disallowed.window.eval(script('web-connect.js'));
  disallowed.window.dispatchEvent(new disallowed.window.MessageEvent('message', { origin: 'https://attacker.invalid', source: disallowed.window, data }));
  await tick(); assert.equal(calls.length, 1);
});

for (const [origin, api] of Object.entries({ 'https://trocheck.vercel.app': 'https://trocheck-api.onrender.com/api/v1',
  'http://localhost:3000': 'http://127.0.0.1:8000/api/v1', 'http://127.0.0.1:3000': 'http://127.0.0.1:8000/api/v1' })) {
  test(`connection verifies auth before storing and maps API from ${origin}`, async () => {
    const calls = [];
    const bg = worker({ fetcher: async (url, options) => {
      calls.push(url);
      assert.equal(bg.config.trocheckToken, undefined);
      assert.equal(options.headers.Authorization, 'Bearer fake-token');
      return json({ username: 'tester' });
    } });
    const answer = await bg.send({ type: 'CONNECT_WEB', origin, apiUrl: 'https://attacker.invalid', token: 'fake-token' },
      { id: 'extension', url: `${origin}/tai-khoan`, tab: { id: 9 } });
    assert.equal(answer.ok, true);
    assert.deepEqual(calls, [`${api}/auth/me`]);
    assert.equal(bg.config.trocheckToken, 'fake-token');
    assert.equal(bg.config.trocheckApiUrl, api);
    assert.equal(bg.config.trocheckAutoSend, true);
  });
}

test('failed auth or mismatched/disallowed origin never stores a token', async () => {
  let calls = 0;
  const bg = worker({ fetcher: async () => { calls++; return json({}, 401); } });
  for (const [url, origin] of [['https://attacker.invalid', 'https://attacker.invalid'],
    ['https://trocheck.vercel.app', 'http://localhost:3000'], ['https://trocheck.vercel.app', 'https://trocheck.vercel.app']]) {
    assert.equal((await bg.send({ type: 'CONNECT_WEB', origin, token: 'fake-token' }, { id: 'extension', url, tab: { id: 9 } })).ok, false);
    assert.equal(bg.config.trocheckToken, undefined);
  }
  assert.equal(calls, 1);
});

test('saving automatically schedules and sends masked posts and downloaded photos once', async () => {
  const calls = [];
  const bg = worker({ config: connected(), fetcher: async (url, options) => {
    calls.push(url);
    if (url.endsWith('/ingest/batch')) {
      assert.equal(options.body.includes('0901234567'), false);
      return ingestAnswer(options);
    }
    if (url.includes('/ingest/images?')) return json({ status: 'created' });
    return { ok: true, headers: { get: () => null }, blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) };
  } });
  assert.equal((await bg.save([rawPost('123', ['https://example.invalid/photo.jpg'])])).saved, 1);
  await until(async () => (await bg.context.TroStorage.readImages('123'))[0]?.status === 'downloaded');
  assert.ok(bg.alarms.has('send-to-trocheck'));
  bg.alarm('send-to-trocheck');
  await until(() => bg.config.trocheckSync?.lastSent);
  assert.equal((await bg.context.TroStorage.readUnsent()).length, 0);
  assert.equal((await bg.context.TroStorage.readImagesToUpload()).length, 0);
  assert.equal(calls.filter(url => url.endsWith('/ingest/batch')).length, 1);
  assert.equal(calls.filter(url => url.includes('/ingest/images?')).length, 1);
  assert.equal(bg.badges.get(1), '1');
});

test('alarm and manual triggers share one in-flight send', async () => {
  let release, started = false, calls = 0;
  const bg = worker({ config: connected(), fetcher: async (url, options) => {
    calls++; started = true; await new Promise(resolve => { release = resolve; }); return ingestAnswer(options);
  } });
  await bg.save();
  const first = bg.internal({ type: 'SEND_NOW' });
  await until(() => started);
  bg.alarm('send-to-trocheck');
  const second = bg.internal({ type: 'SEND_NOW' });
  await tick(); release();
  assert.equal((await first).ok, true);
  assert.equal((await second).ok, true);
  assert.equal(calls, 1);
});

for (const status of [401, 403]) {
  test(`HTTP ${status} stops auto-send with an actionable reason and retains posts`, async () => {
    let calls = 0;
    const bg = worker({ config: connected(), fetcher: async () => { calls++; return json({}, status); } });
    await bg.save(); bg.alarm('send-to-trocheck');
    await until(() => bg.config.trocheckSync?.blocked);
    assert.match(bg.config.trocheckSync.error, status === 401 ? /Kết nối lại/ : /collector.*quản trị viên/);
    assert.equal((await bg.context.TroStorage.readUnsent()).length, 1);
    assert.equal(bg.alarms.has('send-to-trocheck'), false);
    bg.alarm('download-pending-images'); await tick(); await tick();
    assert.equal(calls, 1);
    await until(() => bg.badges.get(1) === '!');
  });
}

for (const status of [503, 429, 'network']) {
  test(`${status} retains unsent posts and schedules a durable retry`, async () => {
    const config = connected();
    const bg = worker({ config, fetcher: async () => { if (status === 'network') throw new Error('offline'); return json({}, status); } });
    await bg.save(); bg.alarm('send-to-trocheck');
    await until(() => config.trocheckSync?.nextAttempt);
    assert.equal(config.trocheckSync.blocked, false);
    assert.equal((await bg.context.TroStorage.readUnsent()).length, 1);
    assert.equal(bg.alarms.get('send-to-trocheck').when, config.trocheckSync.nextAttempt);
    assert.ok(config.trocheckSync.nextAttempt >= Date.now() + (status === 429 ? 69000 : 59000));
    assert.match(config.trocheckSync.error, /vẫn ở trên máy/);
  });
}

test('a daily cap waits until the store says, keeps the rest local and still sends photos', async () => {
  const config = connected();
  const paths = [];
  const capped = { ok: false, status: 429, headers: { get: name => name === 'Retry-After' ? '7200' : null },
    json: async () => ({ error: { code: 'daily_limit', message: 'Hôm nay tài khoản này đã gửi đủ 200 bài mới.' } }) };
  const bg = worker({ config, fetcher: async url => { paths.push(new URL(url).pathname.split('/').pop()); return capped; } });
  bg.context.TroStorage.readImagesToUpload = async () => [{ image: { id: 'i1', data: new Blob(['x'], { type: 'image/jpeg' }) }, record: rawPost('900') }];
  await bg.save(); bg.alarm('send-to-trocheck');
  await until(() => config.trocheckSync?.nextAttempt);
  assert.deepEqual(paths, ['batch', 'images']);
  assert.equal(config.trocheckSync.blocked, false);
  assert.equal(config.trocheckSync.daily, true);
  assert.equal((await bg.context.TroStorage.readUnsent()).length, 1);
  const wait = config.trocheckSync.nextAttempt - Date.now();
  assert.ok(wait > 7200 * 1000 && wait < 7200 * 1000 + 70000, String(wait));
  assert.equal(bg.alarms.get('send-to-trocheck').when, config.trocheckSync.nextAttempt);
  assert.match(config.trocheckSync.error, /^Hôm nay tài khoản này đã gửi đủ 200 bài mới\. Phần còn lại vẫn ở trên máy và sẽ tự gửi tiếp sau 0 giờ\.$/);
  assert.match((await bg.save([rawPost('901')])).note, /sau 0 giờ/);
});

const capAnswer = (message, seconds) => ({ ok: false, status: 429, headers: { get: name => name === 'Retry-After' ? String(seconds) : null },
  json: async () => ({ error: { code: 'daily_limit', message } }) });
const PHOTO_CAP = 'Hôm nay tài khoản này đã gửi đủ 600 ảnh.';
const withPhoto = bg => { bg.context.TroStorage.readImagesToUpload = async () => [{ image: { id: 'i1', data: new Blob(['x'], { type: 'image/jpeg' }) }, record: rawPost('900') }]; };

test('a photo daily cap pauses only photos: new posts still go on the next automatic run, photos wait for Retry-After', async () => {
  const config = connected();
  const paths = [];
  const bg = worker({ config, fetcher: async (url, options) => {
    const path = new URL(url).pathname.split('/').pop();
    paths.push(path);
    return path === 'images' ? capAnswer(PHOTO_CAP, 7200) : ingestAnswer(options);
  } });
  withPhoto(bg);
  await bg.save(); bg.alarm('send-to-trocheck');
  await until(() => config.trocheckSync?.imagesNextAttempt);
  assert.deepEqual(paths, ['batch', 'images']);
  assert.equal(config.trocheckSync.blocked, undefined);
  assert.equal(config.trocheckSync.daily, undefined);
  assert.equal(config.trocheckSync.nextAttempt, undefined);
  assert.equal((await bg.context.TroStorage.readUnsent()).length, 0);
  const wait = config.trocheckSync.imagesNextAttempt - Date.now();
  assert.ok(wait > 7200 * 1000 && wait < 7200 * 1000 + 70000, String(wait));
  assert.equal(config.trocheckSync.imagesError, `${PHOTO_CAP} Bài vẫn gửi bình thường; ảnh còn lại sẽ gửi tiếp sau 0 giờ.`);
  assert.equal(bg.alarms.get('send-to-trocheck').when, config.trocheckSync.imagesNextAttempt);
  // The note is informative and the badge stays a count, not "!".
  assert.match((await bg.save([rawPost('901')])).note, /Bài vẫn gửi bình thường.*sau 0 giờ/);
  assert.ok(bg.alarms.get('send-to-trocheck').when < Date.now() + 10000);
  await until(async () => bg.badges.get(1) === '2');
  // The next automatic run sends the new post and does not touch the photo endpoint.
  paths.length = 0;
  bg.alarm('send-to-trocheck');
  await until(() => paths.length);
  await until(async () => (await bg.context.TroStorage.readUnsent()).length === 0);
  assert.deepEqual(paths, ['batch']);
  assert.ok(config.trocheckSync.imagesNextAttempt > Date.now() + 7000 * 1000);
  assert.equal(bg.alarms.get('send-to-trocheck').when, config.trocheckSync.imagesNextAttempt);
});

test('photos are tried again once the photo Retry-After has passed', async () => {
  const config = connected();
  let photoCalls = 0;
  const bg = worker({ config, fetcher: async (url, options) => {
    if (!url.includes('/ingest/images?')) return ingestAnswer(options);
    photoCalls++;
    return photoCalls === 1 ? capAnswer(PHOTO_CAP, 7200) : json({ status: 'created' });
  } });
  withPhoto(bg);
  await bg.save(); bg.alarm('send-to-trocheck');
  await until(() => config.trocheckSync?.imagesNextAttempt);
  bg.alarm('send-to-trocheck'); await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(photoCalls, 1, 'no retry before Retry-After');
  config.trocheckSync.imagesNextAttempt = Date.now() - 1;
  bg.alarm('send-to-trocheck');
  await until(() => photoCalls === 2);
  await until(() => config.trocheckSync?.lastSent && config.trocheckSync.imagesNextAttempt === undefined);
  assert.equal(config.trocheckSync.imagesError, undefined);
});

test('both caps together: posts wait for the post cap, photos for the photo cap, each with its own time', async () => {
  const config = connected();
  const bg = worker({ config, fetcher: async url => url.includes('/ingest/images?')
    ? capAnswer(PHOTO_CAP, 3600) : capAnswer('Hôm nay tài khoản này đã gửi đủ 200 bài mới.', 7200) });
  withPhoto(bg);
  await bg.save(); bg.alarm('send-to-trocheck');
  await until(() => config.trocheckSync?.nextAttempt);
  assert.equal(config.trocheckSync.daily, true);
  assert.match(config.trocheckSync.error, /200 bài mới/);
  assert.ok(config.trocheckSync.nextAttempt - Date.now() > 7200 * 1000);
  assert.ok(config.trocheckSync.imagesNextAttempt - Date.now() > 3600 * 1000);
  assert.ok(config.trocheckSync.imagesNextAttempt < config.trocheckSync.nextAttempt);
  assert.equal(config.trocheckSync.blocked, false);
  assert.equal((await bg.context.TroStorage.readUnsent()).length, 1);
  assert.equal(bg.alarms.get('send-to-trocheck').when, config.trocheckSync.imagesNextAttempt);
  assert.match((await bg.save([rawPost('902')])).note, /200 bài mới/);
});

test('auto-send off and disconnect keep local data, while manual send remains available', async () => {
  let calls = 0;
  const bg = worker({ config: { ...connected(), trocheckAutoSend: false }, fetcher: async (url, options) => { calls++; return ingestAnswer(options); } });
  await bg.save(); bg.alarm('send-to-trocheck'); bg.alarm('download-pending-images');
  await tick(); await tick();
  assert.equal(calls, 0);
  assert.equal(bg.alarms.has('send-to-trocheck'), false);
  assert.equal((await bg.internal({ type: 'SEND_NOW' })).ok, true);
  assert.equal(calls, 1);
  await bg.internal({ type: 'DISCONNECT' });
  assert.equal(bg.config.trocheckToken, undefined);
  assert.equal((await bg.context.TroStorage.readPage()).total, 1);
  await bg.save([rawPost('456')]); bg.alarm('send-to-trocheck'); await tick();
  assert.equal(calls, 1);
  bg.update('https://www.facebook.com/');
  await until(() => bg.badges.get(1) === '');
});

for (const status of [401, 403, 503]) {
  test(`photo HTTP ${status} retains the photo and ${status === 503 ? 'schedules retry' : 'blocks auto-send'}`, async () => {
    const bg = worker({ config: connected(), fetcher: async (url, options) => {
      if (url.endsWith('/ingest/batch')) return ingestAnswer(options);
      if (url.includes('/ingest/images?')) return json({}, status);
      return { ok: true, headers: { get: () => null }, blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) };
    } });
    await bg.save([rawPost('123', ['https://example.invalid/photo.jpg'])]);
    await until(async () => (await bg.context.TroStorage.readImages('123'))[0]?.status === 'downloaded');
    bg.alarm('send-to-trocheck');
    await until(() => bg.config.trocheckSync?.error);
    assert.equal((await bg.context.TroStorage.readUnsent()).length, 0);
    assert.equal((await bg.context.TroStorage.readImagesToUpload()).length, 1);
    assert.equal(bg.config.trocheckSync.blocked, status !== 503);
    assert.equal(bg.alarms.has('send-to-trocheck'), status === 503);
  });
}

test('retry delay survives worker restart, grows on repeated failures, and successful retry clears it', async () => {
  const config = connected(), factory = new IDBFactory(), session = {};
  let calls = 0;
  const fail = async () => { calls++; return json({}, 503); };
  const first = worker({ config, factory, session, fetcher: fail });
  await first.save(); first.alarm('send-to-trocheck');
  await until(() => config.trocheckSync?.nextAttempt);
  assert.equal(config.trocheckSync.attempts, 1);
  const restarted = worker({ config, factory, session, fetcher: fail });
  restarted.alarm('download-pending-images'); await tick(); await tick();
  assert.equal(calls, 1, 'periodic trigger honors persisted retry time');
  config.trocheckSync.nextAttempt = 0;
  restarted.alarm('send-to-trocheck');
  await until(() => config.trocheckSync.attempts === 2);
  assert.ok(config.trocheckSync.nextAttempt >= Date.now() + 119000);
  config.trocheckSync.nextAttempt = 0;
  const recovered = worker({ config, factory, session, fetcher: async (url, options) => ingestAnswer(options) });
  recovered.alarm('send-to-trocheck');
  await until(() => config.trocheckSync.lastSent);
  assert.equal(config.trocheckSync.error, undefined);
  assert.equal((await recovered.context.TroStorage.readUnsent()).length, 0);
  const state = await recovered.internal({ type: 'GET_STATUS', tabId: 1 });
  assert.equal(state.saved, 1);
  assert.equal(state.sent, 1);
});

test('disconnected badge warns only on supported routes and partial posts never increase its count', async () => {
  const bg = worker();
  await bg.save([{ ...rawPost(), textStatus: 'partial' }]);
  assert.equal(bg.badges.get(1), '!');
  assert.equal((await bg.internal({ type: 'GET_STATUS', tabId: 1 })).saved, 0);
  bg.update('https://www.facebook.com/profile.php?id=123');
  await until(() => bg.badges.get(1) === '');
  assert.equal((await bg.context.TroStorage.readPage()).total, 0);
});

test('overlapping saves keep the tab counter consistent with local storage', async () => {
  const bg = worker({ config: connected() });
  const originalGet = bg.context.chrome.storage.session.get;
  bg.context.chrome.storage.session.get = async keys => { const snapshot = await originalGet(keys); await tick(); return snapshot; };
  await Promise.all([bg.save([rawPost('1')]), bg.save([rawPost('2')])]);
  assert.equal((await bg.internal({ type: 'GET_STATUS', tabId: 1 })).saved, 2);
  assert.equal((await bg.context.TroStorage.readPage()).total, 2);
});

test('one-click connection retries a waking API and stores nothing until auth succeeds', async () => {
  let calls = 0;
  const bg = worker({ fetcher: async () => {
    calls++;
    assert.equal(bg.config.trocheckToken, undefined);
    if (calls === 1) throw new Error('wake timeout');
    return calls === 2 ? json({}, 503) : json({ username: 'tester' });
  } });
  const answer = await bg.send({ type: 'CONNECT_WEB', origin: 'https://trocheck.vercel.app', token: 'fake-token' },
    { id: 'extension', url: 'https://trocheck.vercel.app/tai-khoan', tab: { id: 9 } });
  assert.equal(answer.ok, true);
  assert.equal(calls, 3);
  assert.equal(bg.config.trocheckToken, 'fake-token');
});

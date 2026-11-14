const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const script = (name) => fs.readFileSync(path.join(__dirname, '../extension', name), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

test('popup links to submitted posts on the same web app as account connection', async t => {
  const win = popup(t, () => ({ posts: [] }));
  await settle();
  const link = win.document.querySelector('#my-posts');
  assert.equal(link.textContent, 'Xem bài đã gửi');
  assert.equal(link.href, 'https://trocheck.vercel.app/bai-cua-toi');
  assert.equal(link.target, '_blank');
  assert.match(link.rel, /noopener/);
  assert.equal(JSON.parse(script('manifest.json')).version, '0.3.4');
});

function popup(t, sendMessage, { url = 'https://www.facebook.com/groups/42/', state = {} } = {}) {
  const dom = new JSDOM(script('popup.html'), { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.chrome = { runtime: { sendMessage: async () => ({ connected: true, saved: sendMessage().posts?.length ?? 0,
    waiting: 2, sent: 3, account: 'Người thu bài', autoSend: true, ...state }) }, tabs: {
    query: async () => [{ id: 12, url }],
    sendMessage: async (id, message) => {
      assert.equal(id, 12);
      assert.equal(message.type, 'GET_COLLECTED_POSTS');
      return sendMessage();
    },
  } };
  dom.window.eval(script('popup.js'));
  return dom.window;
}

test('popup exports a fresh snapshot as a JSON array without adding download permissions', async (t) => {
  let posts = [{ postId: '1', text: 'First post', images: [], postUrl: 'https://www.facebook.com/groups/42/posts/1/' }];
  const win = popup(t, () => ({ posts }));
  let blob;
  let filename;
  win.URL.createObjectURL = value => { blob = value; return 'blob:test'; };
  win.URL.revokeObjectURL = () => {};
  win.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
  await settle();
  assert.equal(win.document.querySelector('#download').disabled, false);
  assert.match(win.document.querySelector('#status').textContent, /Đã lưu 1 bài/);
  posts = [...posts, { postId: '2', text: 'Newly collected post', images: ['https://example.com/room.jpg'], postUrl: 'https://www.facebook.com/groups/42/posts/2/' }];
  win.document.querySelector('#download').click();
  await settle();
  const text = await new Promise((resolve, reject) => {
    const reader = new win.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
  assert.deepEqual(JSON.parse(text), posts);
  assert.match(filename, /^facebook-posts-.*\.json$/);
  assert.match(win.document.querySelector('#status').textContent, /Đã xuất 2/);
  const manifest = JSON.parse(script('manifest.json'));
  assert.equal(manifest.action.default_popup, 'popup.html');
  assert.equal(manifest.permissions?.includes('downloads') || false, false);
});

test('popup explains how to recover when the active tab has no collector', async (t) => {
  const win = popup(t, () => ({ posts: [] }));
  win.chrome.tabs.sendMessage = async () => { throw new Error('Receiving end does not exist'); };
  await settle();
  assert.equal(win.document.querySelector('#download').disabled, true);
  assert.match(win.document.querySelector('#status').textContent, /tải lại trang/);
});

test('popup does not export an empty collection', async (t) => {
  const win = popup(t, () => ({ posts: [] }));
  await settle();
  assert.equal(win.document.querySelector('#download').disabled, true);
  assert.match(win.document.querySelector('#status').textContent, /Đã lưu 0 bài/);
});

test('content script returns its current snapshot only for extension-owned requests', async (t) => {
  const dom = new JSDOM('<div role="feed"><div><div data-ad-rendering-role="profile_name">Author</div><a href="/groups/42/posts/123/">time</a><div data-ad-preview="message">A room.</div></div></div>', {
    url: 'https://www.facebook.com/groups/42/', runScripts: 'outside-only',
  });
  t.after(() => { dom.window.troCollector?.stop(); dom.window.close(); });
  let listener;
  dom.window.chrome = { runtime: { id: 'test-extension', sendMessage: async () => ({ ok: true, saved: 1 }), onMessage: { addListener(fn) { listener = fn; } } } };
  dom.window.console.info = () => {};
  dom.window.eval(script('collector.js'));
  dom.window.eval(script('privacy.js'));
  dom.window.eval(script('content-script.js'));
  await dom.window.troCollector.flush();
  let response;
  listener({ type: 'GET_COLLECTED_POSTS' }, { id: 'another-extension' }, value => { response = value; });
  assert.equal(response, undefined);
  listener({ type: 'GET_COLLECTED_POSTS' }, { id: 'test-extension' }, value => { response = value; });
  assert.equal(response.posts.length, 1);
  assert.equal(response.posts[0].text, 'A room.');
});

test('dashboard opens even when the active tab has no collector', async (t) => {
  const win = popup(t, () => { throw new Error('No collector'); });
  let opened;
  win.chrome.runtime = { getURL: name => `chrome-extension://test/${name}` };
  win.chrome.tabs.create = async options => { opened = options.url; };
  await settle();
  win.document.querySelector('#dashboard').click();
  await settle();
  assert.equal(opened, 'chrome-extension://test/dashboard.html');
});

test('popup reports supported tab counts, account and last send error', async t => {
  const win = popup(t, () => ({ posts: [{ postId: '1' }] }), { state: { sync: { error: 'Tài khoản chưa có quyền thu dữ liệu. Liên hệ quản trị viên.' } } });
  await settle();
  assert.match(win.document.querySelector('#status').textContent, /Đã lưu 1 bài trong tab này;.*2 bài chờ gửi và 3 bài đã gửi/);
  assert.match(win.document.querySelector('#connection').textContent, /Người thu bài.*chưa có quyền thu dữ liệu/);
});

for (const url of ['https://www.facebook.com/', 'https://www.facebook.com/profile.php?id=123', 'https://www.facebook.com/marketplace/']) {
  test(`popup explains unsupported Facebook route ${url}`, async t => {
    const win = popup(t, () => ({ posts: [] }), { url });
    await settle();
    assert.match(win.document.querySelector('#status').textContent, /Chỉ lưu nhóm và tìm kiếm bài viết Facebook/);
    assert.equal(win.document.querySelector('#download').disabled, true);
  });
}

test('popup explains a non-Facebook tab and offers one-click connection', async t => {
  const win = popup(t, () => ({ posts: [] }), { url: 'https://example.org/', state: { connected: false } });
  let opened;
  win.chrome.tabs.create = async options => { opened = options.url; };
  await settle();
  assert.match(win.document.querySelector('#status').textContent, /Tab này không phải Facebook/);
  assert.match(win.document.querySelector('#connection').textContent, /Chưa kết nối/);
  assert.equal(win.document.querySelector('#connect').hidden, false);
  win.document.querySelector('#connect').click();
  assert.equal(opened, 'https://trocheck.vercel.app/tai-khoan');
});

test('popup keeps local collection visible while a supported tab is not connected', async t => {
  const win = popup(t, () => ({ posts: [{ postId: '1' }] }), { state: { connected: false } });
  await settle();
  assert.match(win.document.querySelector('#status').textContent, /Đã lưu 1 bài trong tab này/);
  assert.match(win.document.querySelector('#connection').textContent, /Chưa kết nối.*Bấm Kết nối/);
  assert.equal(win.document.querySelector('#connect').hidden, false);
  assert.equal(win.document.querySelector('#disconnect').hidden, true);
});

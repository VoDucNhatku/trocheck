const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const script = (name) => fs.readFileSync(path.join(__dirname, '../extension', name), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function popup(t, sendMessage) {
  const dom = new JSDOM(script('popup.html'), { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.chrome = { tabs: {
    query: async () => [{ id: 12 }],
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
  const win = popup(t, () => { throw new Error('Receiving end does not exist'); });
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

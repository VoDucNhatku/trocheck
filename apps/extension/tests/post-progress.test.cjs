const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync(path.join(__dirname, '../extension/post-progress.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

test('server progress uses plain text, estimates and a 5-second poll that stops when finished', async t => {
  const dom = new JSDOM('<div id="progress"></div>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const win = dom.window;
  let calls = 0, timer, delay;
  win.setTimeout = (callback, ms) => { timer = callback; delay = ms; return 1; };
  win.clearTimeout = () => { timer = undefined; };
  win.chrome = { runtime: { sendMessage: async message => {
    assert.equal(message.type, 'GET_POST_PROGRESS'); calls++;
    return { ok: true, connected: true, summary: { active: calls === 1, estimated_wait_seconds: 60,
      stage_counts: calls === 1 ? { queued: 12, reading: 3, needs_review: 40 } : { published: 55 } },
      items: [{ excerpt: '<img src=x onerror=alert(1)>', progress: { stage: 'queued', queue_position: 7, estimated_wait_seconds: 90 } }] };
  } } };
  win.eval(source);
  const box = win.document.querySelector('#progress');
  win.TroPostProgress.mount(box);
  await settle();
  assert.match(box.textContent, /12 bài đang chờ \(khoảng 1 phút\).*3 bài đang đọc.*40 bài chờ duyệt/);
  assert.match(box.textContent, /vị trí 7 \(khoảng 2 phút\)/);
  assert.equal(box.querySelectorAll('img,em,i').length, 0);
  assert.equal(delay, 5000);
  await timer();
  assert.equal(calls, 2);
  assert.equal(timer, undefined);
  assert.match(box.textContent, /55 bài đã công khai/);
});

test('unconnected accounts expose no server posts and schedule no polling', async t => {
  const dom = new JSDOM('<div id="progress">old private text</div>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const win = dom.window;
  win.chrome = { runtime: { sendMessage: async () => ({ ok: true, connected: false }) } };
  win.setTimeout = () => assert.fail('must not poll an unconnected account');
  win.eval(source);
  const box = win.document.querySelector('#progress');
  win.TroPostProgress.mount(box);
  await settle();
  assert.equal(box.textContent, '');
});

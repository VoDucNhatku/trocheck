const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { IDBFactory, IDBKeyRange } = require('fake-indexeddb');

const script = name => fs.readFileSync(`${__dirname}/../extension/${name}`, 'utf8');
const post = { postId: '123', postUrl: 'https://www.facebook.com/groups/42/posts/123/',
  text: 'A room', images: ['https://example.com/room.jpg'], textStatus: 'visible',
  imageStatus: 'visible-only', linkSource: 'permalink' };
const response = text => ({ ok: true, headers: { get: () => null }, blob: async () => new Blob([text], { type: 'image/png' }) });

async function eventually(check) {
  for (let i = 0; i < 100; i++) {
    const result = await check();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for the image worker');
}

test('background downloads images and does not restore an old image after clearing data', async () => {
  let listener;
  let started;
  const downloadStarted = new Promise(resolve => { started = resolve; });
  let completeFirst;
  let calls = 0;
  const alarms = [];
  const context = vm.createContext({
    indexedDB: new IDBFactory(), IDBKeyRange, URL, AbortController, setTimeout, clearTimeout,
    console: { error() {} },
    fetch: () => {
      calls++;
      if (calls === 1) {
        started();
        return new Promise(resolve => { completeFirst = resolve; });
      }
      return Promise.resolve(response('new'));
    },
    chrome: { runtime: { id: 'extension', onMessage: { addListener(fn) { listener = fn; } } },
      alarms: { create(name, options) { alarms.push([name, options.periodInMinutes]); }, onAlarm: { addListener() {} } } },
  });
  context.importScripts = name => vm.runInContext(script(name), context);
  vm.runInContext(script('background.js'), context);
  const sender = { id: 'extension', url: 'https://www.facebook.com/groups/42/', tab: { id: 1 } };
  const send = () => new Promise(resolve => listener({ type: 'SAVE_RAW_POSTS', posts: [post] }, sender, resolve));
  assert.equal((await send()).saved, 1);
  await downloadStarted;
  await context.TroStorage.clearAll();
  assert.equal((await send()).saved, 1);
  completeFirst(response('old'));
  const image = await eventually(async () => {
    const [item] = await context.TroStorage.readImages('123');
    return item?.status === 'downloaded' ? item : null;
  });
  assert.equal(await image.data.text(), 'new');
  assert.equal(calls, 2);
  assert.equal(alarms[0][0], 'download-pending-images');
  assert.equal(alarms[0][1], 1);
});

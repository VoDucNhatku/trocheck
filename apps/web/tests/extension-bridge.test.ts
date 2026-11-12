import assert from 'node:assert/strict';
import test from 'node:test';
import { requestExtension } from '../src/lib/workspace/extension-bridge';

function browser(t: { after: (callback: () => void) => void }) {
  const listeners = new Set<(event: MessageEvent) => void>();
  const sent: { data: Record<string, unknown>; origin: string }[] = [];
  let expire: () => void = () => {};
  const fake = {
    location: { origin: 'https://trocheck.vercel.app' },
    addEventListener: (_: string, callback: (event: MessageEvent) => void) => listeners.add(callback),
    removeEventListener: (_: string, callback: (event: MessageEvent) => void) => listeners.delete(callback),
    setTimeout: (callback: () => void) => { expire = callback; return 1; },
    clearTimeout: () => {},
    postMessage: (data: Record<string, unknown>, origin: string) => sent.push({ data, origin }),
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: fake, configurable: true });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); });
  return { fake, sent, listeners, expire: () => expire(),
    reply: (data: Record<string, unknown>, origin = fake.location.origin, source: unknown = fake) => {
      for (const callback of listeners) callback({ data, origin, source } as MessageEvent);
    } };
}

test('web bridge pins targetOrigin and ignores forged, unrelated or mismatched answers', async t => {
  const env = browser(t);
  const promise = requestExtension('PING');
  const request = env.sent[0];
  assert.equal(request.origin, env.fake.location.origin);
  const answer = { source: 'trocheck-extension', type: 'PONG', requestId: request.data.requestId, ok: true };
  env.reply(answer, 'https://attacker.invalid');
  env.reply(answer, env.fake.location.origin, null);
  env.reply({ ...answer, requestId: 'wrong' });
  env.reply({ ...answer, type: 'CONNECTED' });
  assert.equal(env.listeners.size, 1);
  env.reply(answer);
  assert.deepEqual(await promise, { ok: true, error: undefined });
  assert.equal(env.listeners.size, 0);
});

test('web bridge reports missing extension and returns exact connection failures', async t => {
  const env = browser(t);
  const missing = requestExtension('PING'); env.expire();
  await assert.rejects(missing, /Chưa tìm thấy extension.*Cài hoặc bật/);
  assert.equal(env.listeners.size, 0);
  const connection = requestExtension('CONNECT', 'fake-token');
  const request = env.sent[1];
  assert.equal(request.data.token, 'fake-token');
  assert.equal(request.origin, env.fake.location.origin);
  const error = 'Mã kết nối sai, đã bị thu hồi hoặc hết hạn. Kết nối lại trong trang Tài khoản.';
  env.reply({ source: 'trocheck-extension', type: 'CONNECTED', requestId: request.data.requestId, ok: false, error });
  assert.deepEqual(await connection, { ok: false, error });
});

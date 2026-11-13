import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

test('extension guide and Account connection work in an offline browser fixture', async t => {
  const root = path.resolve('.');
  const output = path.resolve('../../.tmp/extension-ui');
  await mkdir(output, { recursive: true });
  await build({ absWorkingDir: root, bundle: true, jsx: 'automatic', outfile: path.join(output, 'fixture.js'),
    loader: { '.woff2': 'file', '.woff': 'file' },
    stdin: { resolveDir: root, sourcefile: 'extension-fixture.tsx', loader: 'tsx', contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { ExtensionTokens } from './src/features/workspace/ExtensionTokens';
      import ExtensionPage from './src/app/(renter)/extension/page';
      import './src/app/globals.css';
      createRoot(document.getElementById('root')!).render(location.pathname === '/extension'
        ? <ExtensionPage /> : <main className="container" style={{paddingBlock:32,maxWidth:760}}><ExtensionTokens /></main>);
    ` },
    plugins: [{ name: 'fixture', setup(builder) {
      builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', contents: 'import React from "react"; export default function Link(props) { return <a {...props}/>; }', resolveDir: root }));
      builder.onLoad({ filter: /\.module\.css$/ }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'local-css' }));
    } }],
  });
  let created = 0;
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith('/api/workspace/team/extension-tokens')) {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'POST') { created++; res.end(JSON.stringify({ id: 'fake-id', token: 'fake-token' })); }
      else res.end(JSON.stringify({ items: created ? [{ id: 'fake-id', name: 'Trình duyệt kiểm thử', revoked_at: null }] : [] }));
      return;
    }
    const file = req.url?.split('/').pop();
    if (file && /\.(js|css|woff2?)$/u.test(file)) {
      try {
        res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'font/woff2');
        res.end(await readFile(path.join(output, file)));
      } catch { res.statusCode = 404; res.end(); }
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Keep the extension's trusted origin, forwarding only this fixture's traffic to its free port.
  const browserOrigin = 'http://127.0.0.1:3000';
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== browserOrigin) return route.abort();
    const response = await route.fetch({ url: origin + url.pathname + url.search });
    return route.fulfill({ response });
  });
  for (const theme of ['light', 'dark']) {
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(browserOrigin + '/extension');
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await page.getByRole('heading', { name: 'Cách cài' }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('ol li').count(), 3);
      assert.match(await page.locator('main, #root').first().innerText(), /edge:\/\/extensions/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(output, `guide-${theme}-${width}.png`), fullPage: true });
    }
  }
  await page.goto(browserOrigin + '/tai-khoan');
  await page.getByRole('button', { name: 'Kết nối extension trên trình duyệt này' }).click();
  await page.getByRole('alert').filter({ hasText: 'Chưa tìm thấy extension' }).waitFor();
  assert.equal(created, 0, 'a missing extension must not create a token');
  assert.equal(await page.getByRole('link', { name: /Xem cách cài extension/ }).count(), 1);
  await page.evaluate(() => {
    window.chrome = { runtime: { sendMessage: async message => {
      if (message.token !== 'fake-token' || message.origin !== location.origin) throw new Error('Unexpected hand-off');
      return window.connectFailure ? { ok: false, error: 'Tài khoản chưa có quyền thu dữ liệu. Liên hệ quản trị viên.' } : { ok: true };
    } } };
  });
  await page.addScriptTag({ path: path.resolve('../extension/extension/web-connect.js') });
  await page.getByRole('button', { name: 'Kết nối extension trên trình duyệt này' }).click();
  await page.getByRole('status').filter({ hasText: 'Đã kết nối với extension' }).waitFor();
  assert.equal(created, 1);
  assert.equal(await page.locator('[data-sensitive]').count(), 0, 'one-click connection must not display the token');
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `account-${theme}.png`), fullPage: true });
  }
  await page.evaluate(() => { window.connectFailure = true; });
  await page.getByRole('button', { name: 'Kết nối extension trên trình duyệt này' }).click();
  await page.getByRole('alert').filter({ hasText: 'Tài khoản chưa có quyền thu dữ liệu. Liên hệ quản trị viên.' }).waitFor();
  await page.getByRole('button', { name: 'Tạo mã kết nối', exact: true }).click();
  await page.locator('[data-sensitive]').waitFor();
  await page.getByRole('button', { name: 'Ẩn mã', exact: true }).click();
  assert.equal(await page.locator('[data-sensitive]').count(), 0);
  assert.deepEqual(errors, []);
});

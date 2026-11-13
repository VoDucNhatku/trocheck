import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

test('Account renders Google and password identities and preserves fields after refresh', async t => {
  const root = path.resolve('.');
  const output = path.resolve('../../.tmp/account-ui');
  await mkdir(output, { recursive: true });
  const google = { user_id: 'synthetic-user', username: 'google_internal_identifier', roles: ['renter'],
    email: 'synthetic@example.com', display_name: 'Nguyễn An', google_connected: true, local_login_enabled: false };
  const local = { ...google, username: 'local-renter', display_name: null, google_connected: false, local_login_enabled: true };
  await build({ absWorkingDir: root, bundle: true, jsx: 'automatic', outfile: path.join(output, 'fixture.js'),
    loader: { '.woff2': 'file', '.woff': 'file' },
    stdin: { resolveDir: root, sourcefile: 'account-fixture.tsx', loader: 'tsx', contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { Account } from './src/features/workspace/Account';
      import './src/app/globals.css';
      const google = ${JSON.stringify(google)}, local = ${JSON.stringify(local)};
      const user = location.pathname === '/local' ? local : { ...google,
        display_name: location.pathname === '/fallback' ? null : google.display_name };
      createRoot(document.getElementById('root')!).render(<main className="container" style={{paddingBlock:32}}><Account user={user} /></main>);
    ` },
    plugins: [{ name: 'fixture', setup(builder) {
      builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx',
        contents: 'import React from "react"; export default function Link(props) { return <a {...props}/>; }', resolveDir: root }));
      builder.onLoad({ filter: /\.module\.css$/ }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'local-css' }));
    } }],
  });
  let refreshFails = false;
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith('/api/workspace/')) {
      res.setHeader('Content-Type', 'application/json');
      if (req.url.endsWith('/auth/me')) {
        res.statusCode = refreshFails ? 503 : 200;
        res.end(JSON.stringify(refreshFails ? { error: { message: 'Synthetic failure' } } : { ...google, display_name: 'Nguyễn Bình' }));
      } else res.end(JSON.stringify({ items: [] }));
      return;
    }
    const file = req.url?.split('/').pop();
    if (file && /^[\w.-]+\.(js|css|woff2?)$/u.test(file)) {
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
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  for (const theme of ['light', 'dark']) {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${origin}/google?theme=${theme}`);
      await expect(page.getByRole('heading', { name: 'Nguyễn An', exact: true })).toBeVisible();
      await expect(page.getByLabel('Email tài khoản', { exact: true })).toHaveValue(google.email);
      await expect(page.getByText('Đã kết nối', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Yêu cầu đặt lại mật khẩu' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Đổi mật khẩu' })).toHaveCount(0);
      await expect(page.getByText(/Mọi tài khoản đã đăng nhập đều có thể gửi bài bằng tiện ích/)).toBeVisible();
      await expect(page.locator('body')).not.toContainText(google.username);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
      await page.screenshot({ path: path.join(output, `google-${theme}-${width}.png`), fullPage: true });
    }
  }
  await page.getByRole('button', { name: 'Tải lại thông tin', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nguyễn Bình', exact: true })).toBeVisible();
  await expect(page.getByLabel('Email tài khoản', { exact: true })).toHaveValue(google.email);
  await expect(page.getByRole('link', { name: 'Yêu cầu đặt lại mật khẩu' })).toHaveCount(0);
  refreshFails = true;
  await page.getByRole('button', { name: 'Tải lại thông tin', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không tải được thông tin tài khoản');
  await expect(page.getByRole('heading', { name: 'Nguyễn Bình', exact: true })).toBeVisible();
  await page.goto(origin + '/fallback');
  await expect(page.getByRole('heading', { name: google.email, exact: true })).toBeVisible();
  await page.goto(origin + '/local');
  await expect(page.getByRole('heading', { name: local.username, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Yêu cầu đặt lại mật khẩu' })).toBeVisible();
  await expect(page.getByText('Chưa kết nối', { exact: true })).toBeVisible();
  assert.deepEqual(errors, []);
});

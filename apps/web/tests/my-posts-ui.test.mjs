import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

test('My posts empty state offers installation and connection, filters and errors work', { timeout: 45000 }, async t => {
  const root = path.resolve('.'), output = path.resolve('../../.tmp/my-posts-ui');
  await mkdir(output, { recursive: true });
  await build({ absWorkingDir: root, bundle: true, jsx: 'automatic', outfile: path.join(output, 'fixture.js'),
    loader: { '.woff2': 'file', '.woff': 'file' },
    stdin: { resolveDir: root, sourcefile: 'my-posts-fixture.tsx', loader: 'tsx', contents: `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import { MyPosts } from './src/features/workspace/MyPosts';
      import './src/app/globals.css';
      createRoot(document.getElementById('root')!).render(<div data-workspace style={{padding:24}}><MyPosts /></div>);
    ` },
    plugins: [{ name: 'fixture', setup(builder) {
      builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx',
        contents: 'import React from "react"; export default function Link(props) { return <a {...props}/>; }', resolveDir: root }));
      builder.onLoad({ filter: /\.module\.css$/ }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'local-css' }));
    } }],
  });
  let fail = false, slow = false, lastQuery = '';
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith('/api/workspace/')) {
      lastQuery = req.url;
      if (slow) await new Promise(resolve => setTimeout(resolve, 1200));
      res.setHeader('Content-Type', 'application/json');
      if (fail) { res.statusCode = 503; res.end(JSON.stringify({ error: { message: 'Chưa tải được bài thử nghiệm.' } })); }
      else res.end(JSON.stringify(req.url.includes('/summary') ? {
        counts: { all: 0, published: 0, waiting: 0, other: 0 }, quota: { used: 0, limit: 200, remaining: 200 },
      } : { items: [], total: 0, page: 1, limit: 20, comparison_baseline: 'real_accepted' }));
      return;
    }
    const file = req.url?.split('/').pop();
    if (file && /^[\w.-]+\.(js|css|woff2?)$/u.test(file)) {
      try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'font/woff2'); res.end(await readFile(path.join(output, file))); }
      catch { res.statusCode = 404; res.end(); } return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  t.after(async () => {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  const page = await browser.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const theme of ['light', 'dark']) for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://127.0.0.1:${server.address().port}/?theme=${theme}`);
    await expect(page.getByText('Bạn chưa gửi bài nào', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cài tiện ích' })).toHaveAttribute('href', '/extension');
    await expect(page.getByRole('link', { name: 'Kết nối tài khoản' })).toHaveAttribute('href', '/tai-khoan');
    await expect(page.getByText('0/200 bài')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bắt đầu trong 4 bước' })).toBeVisible();
    assert.equal(await page.locator('ol li[data-done=false]').count(), 4, 'no step is done for an account with no posts');
    await expect(page.getByText(/không dùng dữ liệu demo/)).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('em,i').count(), 0);
    await page.screenshot({ path: path.join(output, `empty-${theme}-${width}.png`), fullPage: true });
  }
  slow = true;
  await page.getByRole('button', { name: /Đã công khai/ }).click();
  await expect(page.getByText('Đang tải bài đã gửi…', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(output, 'loading.png'), fullPage: true });
  await expect(page.getByText('Chưa có bài ở trạng thái này', { exact: true })).toBeVisible();
  slow = false;
  fail = true;
  await page.getByRole('button', { name: /Tất cả/ }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa tải được bài thử nghiệm.');
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Thử lại', exact: true }).focus();
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toBeFocused();
  await page.screenshot({ path: path.join(output, 'error-focused.png'), fullPage: true });
  fail = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByText('Bạn chưa gửi bài nào', { exact: true })).toBeVisible();
  assert.ok(lastQuery.includes('me/posts'));
  assert.deepEqual(errors, []);
});

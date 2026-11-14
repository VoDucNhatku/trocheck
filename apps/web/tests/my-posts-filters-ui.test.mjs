import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

const comparison = { status: 'insufficient_data', reason_codes: [], criteria: {}, n: 1, message: 'Chưa đủ tin.', similar: [], is_demo: false };
const listing = (id, extra) => ({ listing_id: id, review_status: 'needs_review', reason_codes: [], public_url: null, price_vnd: 4000000,
  price_min_vnd: null, price_form: 'exact', price_basis: 'per_unit', price_period: 'month', area_m2: 22, room_type: 'phong_tro',
  ward_code: null, ward_name: null, resolution: null, old_districts: [], area_match: null, comparison, ...extra });
const post = (id, listings, total = listings.length) => ({ post_id: id, received_at: '2026-11-13T08:00:00', source_group_name: 'Nhóm thử nghiệm',
  permalink: null, excerpt: 'Bài thử nghiệm đã được tạo riêng cho kiểm tra.', status: 'needs_review', reason_codes: [], photo_count: 0,
  listing_total: total, listings });
const options = { areas: [{ key: 'quan-1', name: 'Quận 1', listing_count: 3, post_count: 3 }, { key: 'quan-10', name: 'Quận 10', listing_count: 2, post_count: 2 }],
  wards: [], types: [{ type: 'phong_tro', listing_count: 5 }], price_min_vnd: 2000000, price_max_vnd: 9000000, area_min_m2: 12, area_max_m2: 40, total_listings: 5 };

test('My posts filter bar keeps filters in the URL, shows counts, place source and an empty state', { timeout: 60000 }, async t => {
  const root = path.resolve('.'), output = path.resolve('../../.tmp/my-posts-filters-ui');
  await mkdir(output, { recursive: true });
  await build({ absWorkingDir: root, bundle: true, jsx: 'automatic', outfile: path.join(output, 'fixture.js'),
    loader: { '.woff2': 'file', '.woff': 'file' },
    stdin: { resolveDir: root, sourcefile: 'my-posts-filters-fixture.tsx', loader: 'tsx', contents: `
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
  const requests = [];
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith('/api/workspace/')) {
      requests.push(req.url);
      res.setHeader('Content-Type', 'application/json');
      if (req.url.includes('/summary')) res.end(JSON.stringify({ counts: { all: 200, published: 0, waiting: 200, other: 0 }, quota: { used: 0, limit: null, remaining: null } }));
      else if (req.url.includes('/filters')) res.end(JSON.stringify(options));
      else {
        const url = new URL(req.url, 'http://x');
        const none = url.searchParams.getAll('area').includes('quan-7');
        const tier = url.searchParams.getAll('area').length > 0;
        res.end(JSON.stringify({ items: none ? [] : [post('p1', [listing('l1', { old_districts: [{ key: 'quan-10', name: 'Quận 10' }], area_match: tier ? 'mention' : null }),
          listing('l3', { ward_name: 'Phường Chợ Quán', area_match: tier ? 'multi_area' : null })]),
          post('p2', [listing('l2', { ward_name: 'Phường Sài Gòn', ward_code: '26740', area_match: tier ? 'ward' : null })], 2)],
          total: none ? 0 : 2, page: 1, limit: 20, comparison_baseline: 'real_accepted', matched_listings: none ? 0 : 2, total_sent: 200 }));
      }
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
  t.after(async () => { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  const page = await browser.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const base = `http://127.0.0.1:${server.address().port}/`;
  for (const theme of ['light', 'dark']) for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}?theme=${theme}&khu_vuc=quan-10&gia_max=5&dt_min=20&loai=phong_tro&sap_xep=price_asc`);
    // The URL fills the bar and the request.
    await expect(page.getByText('Quận 10 (cũ) · chưa rõ phường')).toBeVisible();
    await expect(page.getByText('Phường Sài Gòn', { exact: true })).toBeVisible();
    await expect(page.getByText('2 phòng khớp')).toBeVisible();
    // With an area filter each card says why it matched; without one it says nothing.
    await expect(page.getByText('Ở đúng phường', { exact: true })).toBeVisible();
    await expect(page.getByText('Bài nhắc tên quận', { exact: true })).toBeVisible();
    await expect(page.getByText('Bài nhiều khu vực', { exact: true })).toBeVisible();
    await expect(page.getByText('200 bài đã gửi')).toBeVisible();
    await expect(page.getByText('Bài có 2 tin, đang hiện 1 tin khớp bộ lọc.')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Quận 10 \(cũ\)/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Quận 1 \(cũ\)/ })).not.toBeChecked();
    await expect(page.getByLabel('Từ').first()).toHaveValue('');
    await expect(page.locator('input[name=gia_max]')).toHaveValue('5');
    await expect(page.locator('select[name=sap_xep]')).toHaveValue('price_asc');
    const query = requests.filter(url => url.includes('me/posts?')).at(-1);
    for (const part of ['area=quan-10', 'price_max=5000000', 'area_min=20', 'type=phong_tro', 'sort=price_asc', 'rental_only=true']) assert.ok(query.includes(part), part);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('em,i').count(), 0);
    await page.screenshot({ path: path.join(output, `filters-${theme}-${width}.png`), fullPage: true });
  }
  // Apply writes the URL, clear resets it.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base);
  await expect(page.getByText('Ở đúng phường', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Bài nhiều khu vực', { exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: /Quận 1 \(cũ\)/ }).check();
  await page.locator('input[name=gia_min]').fill('2.5');
  await page.getByLabel('Hiện cả bài không phải cho thuê').check();
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await expect.poll(() => page.evaluate(() => location.search)).toBe('?khu_vuc=quan-1&gia_min=2.5&ca_khong_thue=1');
  assert.ok(requests.filter(url => url.includes('me/posts?')).at(-1).includes('rental_only=false'));
  // Status tabs work together with filters.
  await page.getByRole('button', { name: /Đang xử lý/ }).click();
  await expect.poll(() => page.evaluate(() => location.search)).toContain('nhom=waiting');
  assert.ok((await page.evaluate(() => location.search)).includes('khu_vuc=quan-1'));
  await page.getByRole('button', { name: 'Xóa lọc' }).first().click();
  await expect.poll(() => page.evaluate(() => location.search)).toBe('?nhom=waiting');
  // Nothing matches: suggest widening.
  await page.goto(`${base}?khu_vuc=quan-7&gia_max=3`);
  await expect(page.getByText('Không có phòng nào khớp bộ lọc')).toBeVisible();
  await expect(page.getByText('bỏ khu vực đang chọn', { exact: false })).toBeVisible();
  await expect(page.getByText('Tăng mức giá đến.')).toBeVisible();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: 'Xóa lọc' }).last().click();
  await expect(page.getByText('2 bài đã gửi', { exact: false })).toBeVisible();
  assert.deepEqual(errors, []);
});

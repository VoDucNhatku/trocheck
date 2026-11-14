import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

test('analysis displays old-district pool and relaxed area scope on mobile and desktop', { timeout: 45000 }, async t => {
  const root = path.resolve('.'), output = path.resolve('../../.tmp/comparison-scope-ui');
  await mkdir(output, { recursive: true });
  await build({ absWorkingDir: root, bundle: true, jsx: 'automatic', outfile: path.join(output, 'fixture.js'),
    loader: { '.woff2': 'file', '.woff': 'file' },
    stdin: { resolveDir: root, sourcefile: 'comparison-scope-fixture.tsx', loader: 'tsx', contents: `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import { Analysis } from './src/features/workspace/Reading';
      import './src/app/globals.css';
      createRoot(document.getElementById('root')).render(<main data-workspace style={{padding:24}}><Analysis id="synthetic-analysis" /></main>);
    ` },
    plugins: [{ name: 'fixture', setup(builder) {
      builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx',
        contents: 'import React from "react"; export default function Link(props) { return <a {...props}/>; }', resolveDir: root }));
      builder.onLoad({ filter: /\.module\.css$/ }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'local-css' }));
    } }],
  });
  // Invented input only; no production service or stored post is used.
  const text = 'Mẫu kiểm thử tự tạo: phòng trọ 20m2 giá 3tr/tháng tại Thủ Đức.';
  const evidence = (quote, label) => [{ start: text.indexOf(quote), end: text.indexOf(quote) + quote.length, quote, label, method: 'regex' }];
  const listing = { listing_id: 'synthetic-listing', review_status: 'auto_accepted',
    rent: { amount_form: 'exact', amount_vnd: 3000000, visibility: 'disclosed', basis: 'per_unit', period: 'month',
      decision: 'answered', evidence: evidence('3tr/tháng', 'PRICE') },
    area: { amount_form: 'exact', value_m2: 20, evidence: evidence('20m2', 'AREA') },
    room: { property_type: 'phong_tro', furnishing: 'unknown', evidence: evidence('phòng trọ', 'ROOM') },
    location: { resolution: 'unresolved', evidence: evidence('Thủ Đức', 'LOCATION') }, fees: [] };
  const analysis = { analysis_id: 'synthetic-analysis', status: 'succeeded', post_type: 'rental_offer',
    partial: false, contributed: true, is_demo: false, text_complete: true, text, listings: [listing] };
  let pool = 'accepted', relaxed = true;
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith('/api/workspace/')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(req.url.includes('/analyses/') ? analysis : {
        status: 'ok', n: 12, mean_vnd: 3000000, mean_per_m2: null, is_demo: false,
        message: 'Gần mức trung bình của nhóm quận cũ.', reason_codes: relaxed ? ['area_band_relaxed'] : [],
        scope: 'old_district', scope_label: 'Thủ Đức (cũ)', pool, similar: [], data_from: null, data_to: null,
        criteria: { property_type: 'phong_tro', basis: 'per_unit', ward_name: 'Phường thử nghiệm', window_days: 30 },
      }));
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
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  t.after(async () => { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  for (pool of ['accepted', 'auto_checked']) for (relaxed of [false, true]) for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + '/phan-tich/synthetic-analysis');
    const scope = page.locator('[data-scope="old_district"]');
    const poolText = pool === 'accepted' ? 'chỉ gồm tin đã duyệt' : 'gồm tin chưa duyệt, đã qua kiểm tra tự động';
    await expect(scope).toHaveText(`So với tin ở Thủ Đức (cũ) · không cùng phường · ${poolText}${relaxed ? ' · mọi diện tích' : ''}`);
    await expect(scope).toHaveAttribute('data-pool', pool);
    await expect(page.getByText('Phường thử nghiệm', { exact: false })).toHaveCount(0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('em,i').count(), 0);
    if (relaxed) {
      await scope.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `${pool}-${width}.png`) });
    }
  }
  assert.deepEqual(errors, []);
});

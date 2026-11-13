import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

test('Team review labels bot approval and sends versioned undo from the detail screen', async t => {
  const root = path.resolve('.');
  const output = path.resolve('../../.tmp/k-review-ui');
  await mkdir(output, { recursive: true });
  const meta = { decision: 'answered', agreement: 'regex_only', evidence: [] };
  const listing = { listing_id: 'synthetic-listing', listing_index: 0, review_status: 'approved', fees: [],
    rent: { ...meta, decision: 'needs_review', agreement: 'llm_only', visibility: 'disclosed', amount_form: 'exact',
      amount_vnd: 3000000, min_vnd: null, max_vnd: null, basis: 'per_unit', period: 'month', includes: [] },
    area: { ...meta, amount_form: 'exact', value_m2: 20, min_m2: null, max_m2: null, from_dimensions: false },
    room: { ...meta, property_type: 'phong_tro', furnishing: 'unknown' },
    location: { ...meta, ward_code: '25747', ward_name: 'Phường Thủ Dầu Một', resolution: 'exact' } };
  const detail = { listing, version: 2, review_status: 'approved', reasons: ['rent_llm_only'], cluster_id: null,
    post: { post_id: 'synthetic-post', text: 'Cho thuê phòng trọ 20m2 giá 3tr/tháng/phòng. Phường Thủ Dầu Một', permalink: null },
    run: { run_id: 'synthetic-run', llm_status: 'ok', model_id: 'fake-bot', regex_spans: [], llm_spans: [] },
    suspected_duplicates: [], history: [{ source: 'bot', action: 'approve', user_id: 'system', reason: 'Bot đã duyệt', created_at: '2026-11-13T01:00:00Z' }] };
  const queue = { items: [{ listing_id: listing.listing_id, reasons: ['rent_llm_only'], reason: 'rent_llm_only',
    excerpt: detail.post.text, property_type: 'phong_tro', ward_name: 'Phường Thủ Dầu Một', created_at: '2026-11-13T01:00:00Z',
    version: 2, is_demo: false, bot_approved: true }], total: 1, counts: { rent_llm_only: 1 } };
  await build({ absWorkingDir: root, bundle: true, jsx: 'automatic', outfile: path.join(output, 'fixture.js'),
    loader: { '.woff2': 'file', '.woff': 'file' },
    stdin: { resolveDir: root, sourcefile: 'bot-review-fixture.tsx', loader: 'tsx', contents: `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import { Queue } from './src/app/(workspace)/team/duyet/_components/Queue';
      import { ReviewDetail } from './src/app/(workspace)/team/duyet/_components/ReviewDetail';
      import './src/app/globals.css';
      createRoot(document.getElementById('root')).render(location.pathname.endsWith('/synthetic-listing')
        ? <ReviewDetail id="synthetic-listing"/> : <Queue query={location.search.slice(1)}/>);` },
    plugins: [{ name: 'next-fixture', setup(builder) {
      builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', resolveDir: root,
        contents: 'import React from "react"; export default function Link({prefetch, ...props}) { return <a {...props}/>; }' }));
      builder.onLoad({ filter: /\.module\.css$/ }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'local-css' }));
    } }],
  });
  let decision;
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith('/api/workspace/')) {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'POST') {
        let body = ''; for await (const chunk of req) body += chunk;
        decision = JSON.parse(body);
        res.end(JSON.stringify({ listing_id: listing.listing_id, review_status: 'needs_review', version: 3, cluster_id: null }));
      } else res.end(JSON.stringify(req.url.includes('synthetic-listing') ? detail : decision ? { items: [], total: 0, counts: {} } : queue));
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
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + '/team/duyet?status=bot_approved');
    await expect(page.getByRole('link', { name: 'Xem / Hoàn tác' })).toBeVisible();
    await expect(page.locator('strong').filter({ hasText: 'Bot đã duyệt' })).toBeVisible();
    await page.screenshot({ path: path.join(output, `queue-${width}.png`), fullPage: true });
    await page.getByRole('link', { name: 'Xem / Hoàn tác' }).click();
    await expect(page.getByRole('button', { name: 'Hoàn tác', exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(output, `detail-${width}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('gỡ khỏi danh sách công khai');
  await page.getByRole('button', { name: 'Xác nhận hoàn tác' }).click();
  await expect(page).toHaveURL(/decision=undo/);
  assert.deepEqual(decision, { action: 'undo', expected_version: 2 });
  await expect(page.getByRole('status').filter({ hasText: 'Đã hoàn tác quyết định bot.' })).toBeVisible();
  assert.deepEqual(errors, []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

test('owner sees stages and polling stops after review is reached', { timeout: 45000 }, async t => {
  const root = path.resolve('.'), output = path.resolve('../../_handoff/post-progress-ui');
  await mkdir(output, { recursive: true });
  await build({ absWorkingDir: root, bundle: true, jsx: 'automatic', outfile: path.join(output, 'fixture.js'),
    loader: { '.woff2': 'file', '.woff': 'file' },
    stdin: { resolveDir: root, sourcefile: 'progress-fixture.tsx', loader: 'tsx', contents: `
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
  let summaryReads = 0, listReads = 0, stageIndex = 0;
  const stages = ['queued', 'reading', 'asking_ai', 'needs_review'];
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const stage = stages[stageIndex];
    if (req.url?.startsWith('/api/workspace/')) {
      if (req.url.includes('/summary')) {
        summaryReads++;
        res.end(JSON.stringify({ counts: { all: 1, waiting: 1, published: 0, other: 0 },
          quota: { used: 1, limit: 200, remaining: 199 }, stage_counts: { [stage]: 1 }, active: stage !== 'needs_review',
          estimated_wait_seconds: stage === 'queued' ? 60 : null }));
      } else if (req.url.includes('me/posts?')) {
        listReads++;
        res.end(JSON.stringify({ items: [{ post_id: 'owner-post', received_at: '2026-11-18T01:00:00Z', source_group_name: 'Bài thử tiến độ',
          excerpt: 'Cho thuê phòng thử nghiệm.', status: 'received', photo_count: 0, reason_codes: [], listing_total: 0, listings: [],
          progress: { stage, queue_position: stage === 'queued' ? 12 : null, estimated_wait_seconds: stage === 'queued' ? 60 : null } }],
          total: 1, total_sent: 1, page: 1, limit: 20, matched_listings: 0 }));
      } else res.end('[]');
      return;
    }
    const file = req.url?.split('/').pop();
    if (file && /^[\w.-]+\.(js|css)$/u.test(file)) {
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/css');
      res.end(await readFile(path.join(output, file))); return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  t.after(async () => { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.clock.install();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await expect(page.getByText('Đang chờ · vị trí 12 (khoảng 1 phút)', { exact: true }).first()).toBeVisible();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(output, 'queued-mobile.png'), fullPage: true });
  stageIndex = 1;
  await page.clock.fastForward(5000);
  await expect(page.getByText('Đang đọc giá, diện tích, vị trí', { exact: true }).first()).toBeVisible();
  stageIndex = 2;
  await page.clock.fastForward(5000);
  await expect(page.getByText('Đang hỏi AI', { exact: true }).first()).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: path.join(output, 'asking-ai-desktop.png'), fullPage: true });
  stageIndex = 3;
  await page.clock.fastForward(5000);
  await expect(page.getByText('Chờ duyệt', { exact: true }).first()).toBeVisible();
  const reads = [summaryReads, listReads];
  await page.clock.fastForward(15000);
  assert.deepEqual([summaryReads, listReads], reads);
  assert.equal(await page.locator('em,i').count(), 0);
});

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { auditPage, parseOptions, runGate } from '../scripts/qa-gate.mjs';

let browser;
before(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
after(async () => { await browser?.close(); });
const logo = '<img alt="TrọCheck" src="https://qa.invalid/brand/trocheck-icon.png" width="24" height="24">';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="teal"/></svg>';
const shell = content => `<!doctype html><meta charset="utf-8"><style>body{margin:16px;background:white;color:black;font:16px/1.6 Arial}p{margin:12px 0}button{font:inherit}</style>${logo}<main>${content}</main>`;

async function audit(content, width = 390) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.route('https://qa.invalid/**', route => route.fulfill({ contentType: 'image/svg+xml', body: svg }));
    await page.setContent(shell(content), { waitUntil: 'load' });
    return await page.evaluate(auditPage, {});
  } finally { await page.close(); }
}
const has = (result, rule) => result.issues.some(issue => issue.rule === rule && issue.level === 'FAIL');

test('R01 catches authored /phòng across inline nodes, but preserves quotes', async () => {
  assert.ok(has(await audit('<p>Giá 5 triệu/tháng/<span>phòng</span></p>'), 'R01'));
  assert.ok(!has(await audit('<blockquote>5 triệu/tháng/phòng</blockquote><p>Giá theo tháng</p>'), 'R01'));
});

test('R02 catches obsolete product/statistic terms outside quotes', async () => {
  for (const term of ['P25', 'P75', 'trung vị', 'ReNER']) assert.ok(has(await audit(`<p>${term}</p>`), 'R02'), term);
  assert.ok(!has(await audit('<pre>P25 ReNER trung vị</pre><p>Giá trung bình</p>'), 'R02'));
});

test('R04 catches 11px text, and excludes closed details and clipped screen-reader text', async () => {
  assert.ok(has(await audit('<p style="font-size:11px">Chữ quá nhỏ</p>'), 'R04'));
  const clean = await audit('<details><summary>Mở</summary><p style="font-size:8px">Đang đóng</p></details><span style="position:absolute;clip-path:inset(50%);width:1px;height:1px;font-size:8px">Chỉ trình đọc màn hình</span><p style="font-size:12px">Đủ mười hai</p>');
  assert.ok(!has(clean, 'R04'));
});

test('R06 catches number/unit breaks across elements; different font sizes on one line are valid', async () => {
  assert.ok(has(await audit('<p style="width:60px">12,5 <span>triệu</span></p>'), 'R06'));
  assert.ok(has(await audit('<p>12,5 <span style="display:block">triệu</span></p>'), 'R06'));
  assert.ok(has(await audit('<p><span data-phrase>12,5</span><br>triệu</p>'), 'R06'));
  assert.ok(!has(await audit('<p><strong style="font-size:32px">12,5</strong> <span style="font-size:12px">triệu</span></p>'), 'R06'));
});

test('R07 catches document overflow but allows an intentional inner horizontal scroller', async () => {
  assert.ok(has(await audit('<div style="width:800px">Khung rộng</div>'), 'R07'));
  assert.ok(!has(await audit('<div style="overflow:auto;width:100%"><div style="width:800px">Bảng cuộn</div></div>'), 'R07'));
});

test('R08 catches overlapping text, including sticky text', async () => {
  assert.ok(has(await audit('<div style="position:relative;height:70px"><p style="position:absolute;top:0">Chữ thứ nhất</p><p style="position:absolute;top:0">Chữ thứ hai</p></div>'), 'R08'));
  assert.ok(has(await audit('<div style="position:sticky;top:0;height:30px"><span style="position:absolute">Thanh thứ nhất</span><span style="position:absolute">Thanh thứ hai</span></div>'), 'R08'));
});

test('R08 distinguishes healthy heading em-box overlap from actual glyph collisions', async () => {
  assert.ok(!has(await audit('<h1 style="font:34px/.95 Times New Roman">Home<br><span>Home</span></h1>'), 'R08'));
  assert.ok(has(await audit('<p style="font:16px/4px Arial;width:80px">letters letters letters letters letters</p>'), 'R08'));
});

test('R08 clips at every ancestor scroller and ignores closed/transparent descendants', async () => {
  const clean = await audit('<div style="position:relative;height:40px;overflow:hidden"><div style="position:relative;overflow:visible"><p style="position:absolute;top:70px">Chữ đã bị cắt</p></div></div><p>Chữ bên ngoài</p><details><summary>Mở chi tiết</summary><span style="position:absolute;top:100px">Không hiện</span></details><div style="opacity:0"><p style="position:absolute;top:100px">Không hiện</p></div>');
  assert.ok(!has(clean, 'R08'), JSON.stringify(clean.issues));
});

test('R10 catches poor contrast and composes translucent layers accurately', async () => {
  assert.ok(has(await audit('<p style="color:#aaa">Chữ thiếu tương phản</p>'), 'R10'));
  assert.ok(!has(await audit('<div style="background:black"><p style="background:rgba(255,255,255,.5);color:black">Nền xám, chữ đen</p></div>'), 'R10'));
  assert.ok(has(await audit('<div style="opacity:.2"><p>Chữ bị làm mờ</p></div>'), 'R10'));
});

test('R10 marks image backgrounds for manual review instead of inventing a ratio', async () => {
  const result = await audit('<div style="background-image:linear-gradient(white,black)"><p>Chữ trên ảnh</p></div>');
  assert.ok(result.issues.some(issue => issue.rule === 'R10' && issue.level === 'WARN'));
});

test('R11 catches a broken image and missing approved logo, including narrow screens', async () => {
  assert.ok(has(await audit('<img src="data:image/png;base64,broken" alt="Ảnh hỏng">'), 'R11'));
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    await page.setContent('<main>Không có logo</main>');
    assert.ok(has(await page.evaluate(auditPage, {}), 'R11'));
  } finally { await page.close(); }
});

test('R18 catches explicit short phrases across nodes and leaves longer prose free to wrap', async () => {
  assert.ok(has(await audit('<p style="width:40px">Cầu <span>Giấy</span></p><p style="width:55px">thang máy</p>'), 'R18'));
  assert.ok(has(await audit('<p>Cầu<br>Giấy</p>'), 'R18'));
  assert.ok(!has(await audit('<p>Trung bình<br><b>4.100.000 đ</b></p><p>Giá <span>thuê</span></p>'), 'R18'));
  assert.ok(!has(await audit('<p style="width:28px">, dưới</p><p style="width:60px">3/th nha mn</p>'), 'R18'));
  assert.ok(!has(await audit('<p style="width:140px">Một đoạn mô tả dài có thể xuống dòng giữa các cụm từ theo chiều rộng màn hình.</p>'), 'R18'));
});

test('R19 catches dot decimals but accepts Vietnamese thousands, comma decimals, and full dates', async () => {
  assert.ok(has(await audit('<p>Cọc 1.5 tháng; +10.0%</p>'), 'R19'));
  assert.ok(!has(await audit('<p>4.400.000 đ · 1,5 tháng · 1.234,5 m² · 29.10.2026</p>'), 'R19'));
});

test('R30 catches retired teal in backgrounds, gradients and pseudo-elements, without banning yellow', async () => {
  for (const content of ['<p style="color:#005243">Retired text</p>', '<p style="border:2px solid #146c5a">Retired border</p>', '<mark data-entity="PRICE" style="background:#87d5bf">Retired entity</mark>']) {
    assert.ok(has(await audit(content), 'R30'));
  }
  for (const content of ['<button style="background:#005243">Tiếp tục</button>', '<div style="background:linear-gradient(#146c5a,white)">Dải cũ</div>', '<style>.old:before{content:"";display:block;width:30px;height:8px;background:#87d5bf}</style><p class="old">Gạch cũ</p>']) {
    assert.ok(has(await audit(content), 'R30'));
  }
  assert.ok(!has(await audit('<mark data-entity="Giá" style="background:#ffe14d">Giá thuê</mark><button style="background:#ffe14d;color:#15161a">Tiếp tục</button>'), 'R30'));
  assert.ok(!has(await audit('<style>.hidden:before{content:"";background:#005243;opacity:0;display:block;width:10px;height:10px}</style><p class="hidden">Chữ thường</p>'), 'R30'));
});

test('clean control passes all twelve rules', async () => {
  const result = await audit('<h1>TrọCheck</h1><p>Giá trung bình: <span style="white-space:nowrap">4.400.000 đ</span>/tháng</p><p><span style="white-space:nowrap">Cầu Giấy</span></p>');
  assert.deepEqual(result.issues, []);
});

test('arguments reject unsafe labels, unknown modes and cross-origin pages', () => {
  assert.throws(() => parseOptions(['--label', '../escape']), /label/);
  assert.throws(() => parseOptions(['--themes', 'night']), /themes/);
  assert.throws(() => parseOptions(['--pages', '//external.test']), /pages/);
  assert.throws(() => parseOptions(['--widths', '390,no']), /widths/);
  assert.throws(() => parseOptions(['--typo', '1']), /Unknown/);
});

test('R13 and CLI output/exit codes are proven with a temporary loopback fixture', async () => {
  const server = createServer((req, res) => {
    if (req.url.includes('/brand/')) { res.setHeader('Content-Type', 'image/svg+xml'); res.end(svg); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(shell('<h1>TrọCheck</h1><p>Giá trung bình</p>').replace('https://qa.invalid', '') + (req.url.startsWith('/bad') ? '<script>console.error("QA console sentinel"); setTimeout(()=>{throw new Error("QA pageerror sentinel")},0)</script>' : ''));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const temp = await mkdtemp(path.resolve('.tmp/qa-gate-test-'));
  const label = path.basename(temp);
  const common = ['--base', `http://127.0.0.1:${server.address().port}`, '--widths', '390', '--themes', 'light', '--label', label];
  try {
    const report = await runGate(parseOptions([...common, '--pages', '/bad']));
    assert.ok(report.results[0].issues.some(issue => issue.rule === 'R13' && issue.detail.includes('QA console sentinel')));
    assert.ok(report.results[0].issues.some(issue => issue.rule === 'R13' && issue.detail.includes('QA pageerror sentinel')));
    for (const [route, status] of [['/good', 0], ['/bad', 1]]) {
      const result = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['scripts/qa-gate.mjs', ...common, '--pages', route, ...(status === 0 ? ['--themes', 'light,dark', '--widths', '1440,390,320'] : [])], { stdio: ['ignore', 'pipe', 'pipe'] });
        let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
        child.on('error', reject); child.on('close', code => resolve({ code, output }));
      });
      assert.equal(result.code, status, result.output);
      const json = JSON.parse(await readFile(`qa-out/${label}.json`, 'utf8'));
      assert.equal(json.summary.fail > 0, status === 1);
      assert.equal(json.summary.runs, status === 0 ? 6 : 1);
      assert.match(await readFile(`qa-out/${label}.md`, 'utf8'), /FAIL/);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    // Only the exact files and empty directory created by this test are removed.
    await rm(`qa-out/${label}.md`, { force: true });
    await rm(`qa-out/${label}.json`, { force: true });
    await rmdir(temp);
  }
});

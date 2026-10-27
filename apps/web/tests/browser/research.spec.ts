import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin = process.env.RESEARCH_WEB ?? 'http://127.0.0.1:3006';
const apiBase = process.env.RESEARCH_API ?? 'http://127.0.0.1:18003/api/v1';
const shots = path.resolve('../../.tmp/research-shots');
const headers = { Origin: origin, 'X-ReNER-Request': '1' };
async function password() {
  return JSON.parse(await readFile(path.resolve('../../.tmp/interior-test-credentials.json'), 'utf8')).password as string;
}
async function fixture(name = 'F01-basic-ccmn') {
  return JSON.parse(await readFile(path.resolve('../../spec/fixtures/' + name + '.json'), 'utf8'));
}
async function session(page: Page, username = 'researcher') {
  const response = await page.request.post('/api/workspace/auth/login', { headers, data: { username, password: await password() } });
  expect(response.status()).toBe(200);
}
async function storedPost(request: APIRequestContext) {
  const response = await request.post(apiBase + '/auth/login', { data: { username: 'collector', password: await password() } });
  expect(response.status()).toBe(200);
  const posts = await request.get(apiBase + '/team/posts?page_size=1');
  expect(posts.status()).toBe(200);
  const data = await posts.json();
  expect(data.items.length).toBeGreaterThan(0);
  return data.items[0].post_id as string;
}
async function runText(page: Page, text: string) {
  await page.getByLabel('Văn bản bài đăng', { exact: true }).fill(text);
  const response = page.waitForResponse(value => value.url().endsWith('/api/workspace/lab/run') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Chạy đối chiếu', exact: true }).click();
  const result = await response; expect(result.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Bằng chứng trên cùng nguyên văn' })).toBeVisible();
  return result.json();
}
async function screenshot(page: Page, name: string, widths = [1440, 768, 390]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => { window.scrollTo(0, 0); });
    const tokens = await page.locator('[data-workspace]').first().evaluate(element => {
      const style = getComputedStyle(element);
      return Object.fromEntries(['paper', 'surface', 'subtle', 'accent-subtle', 'ink', 'ink-2', 'ink-3', 'accent', 'accent-ink', 'mk-ink', 'mk-price', 'mk-area', 'mk-loc', 'mk-room', 'mk-fee', 'border-strong']
        .map(key => [key, style.getPropertyValue('--' + key).trim()]));
    });
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
        .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const pairs: [string, string, number][] = [
      ...['ink', 'ink-2', 'ink-3'].flatMap(ink => ['paper', 'surface', 'subtle', 'accent-subtle'].map(ground => [ink, ground, 4.5] as [string, string, number])),
      ['accent-ink', 'accent', 4.5],
      ...['mk-price', 'mk-area', 'mk-loc', 'mk-room', 'mk-fee'].map(ground => ['mk-ink', ground, 4.5] as [string, string, number]),
      ['border-strong', 'surface', 3], ['border-strong', 'paper', 3],
    ];
    const contrast = pairs.map(([foreground, background, need]) => {
      const a = luminance(tokens[foreground]), b = luminance(tokens[background]);
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      expect(ratio, foreground + ' on ' + background).toBeGreaterThanOrEqual(need);
      return { foreground, background, colors: [tokens[foreground], tokens[background]], ratio, need };
    });
    await writeFile(path.join(shots, 'contrast.json'), JSON.stringify(contrast, null, 2));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: path.join(shots, name + '-' + width + '.png'), fullPage: true });
  }
}
function errorsOn(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}
test.beforeAll(async () => { await mkdir(shots, { recursive: true }); });

test('anonymous routes keep the return path and APIs return 401', async ({ page, request }) => {
  for (const route of ['/team/kiem-tra', '/team/danh-gia']) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp('/dang-nhap\\?next=' + encodeURIComponent(route)));
  }
  expect((await request.get('/api/workspace/eval/runs')).status()).toBe(401);
  expect((await request.post('/api/workspace/lab/run', { headers, data: { text: 'Cho thuê' } })).status()).toBe(401);
});

test('researcher signs in through the UI and sees real evaluation data or the real empty state', async ({ page }) => {
  const errors = errorsOn(page);
  await page.goto('/dang-nhap?next=' + encodeURIComponent('/team/kiem-tra'));
  await page.getByLabel('Tên tài khoản').fill('researcher');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(await password());
  const submit = page.getByRole('button', { name: 'Vào bàn làm việc' });
  await expect(submit).toBeEnabled(); await submit.click();
  await expect(page).toHaveURL(/\/team\/kiem-tra$/);
  await expect(page.getByText('Chưa chạy đối chiếu', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('link', { name: 'Đánh giá', exact: true }).click();
  const response = await page.request.get('/api/workspace/eval/runs');
  expect(response.status()).toBe(200);
  const data = await response.json();
  if (data.items.length === 0) {
    await expect(page.getByText('Chưa có lần chạy đánh giá', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Chọn run', { exact: true })).toBeDisabled();
    await expect(page.getByRole('table')).toHaveCount(0);
    await screenshot(page, 'eval-live-empty');
  } else {
    const run = data.items.find((item: { run_id?: string }) => item.run_id);
    expect(run).toBeTruthy();
    await page.getByLabel('Chọn run', { exact: true }).selectOption(run.run_id);
    await expect(page.getByRole('heading', { name: 'Thông tin lần chạy' })).toBeVisible();
    await screenshot(page, 'eval-live-run');
  }
  expect(errors).toEqual([]);
});

test('renter gets Forbidden on direct URLs and 403 from research APIs', async ({ page }) => {
  await session(page, 'renter');
  for (const route of ['/team/kiem-tra', '/team/danh-gia']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: 'Bạn chưa có quyền vào khu này' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kiểm tra trích xuất', exact: true })).toHaveCount(0);
  }
  expect((await page.request.get('/api/workspace/eval/runs')).status()).toBe(403);
  expect((await page.request.get('/api/workspace/lab/gold/permission-check')).status()).toBe(403);
  expect((await page.request.post('/api/workspace/lab/run', { headers, data: { text: 'Cho thuê' } })).status()).toBe(403);
  await screenshot(page, 'research-forbidden', [1440]);
});

test('admin inherits researcher access on both server routes', async ({ page }) => {
  await session(page, 'admin');
  await page.goto('/team/kiem-tra'); await expect(page.getByRole('heading', { name: 'Kiểm tra trích xuất', exact: true })).toBeVisible();
  await page.goto('/team/danh-gia'); await expect(page.getByRole('heading', { name: 'Đánh giá', exact: true })).toBeVisible();
  expect((await page.request.get('/api/workspace/eval/runs')).status()).toBe(200);
});

test('real Regex Lab: pending, Unicode offsets, evidence selection, BIO and responsive layout', async ({ page }) => {
  const errors = errorsOn(page); await session(page); await page.goto('/team/kiem-tra');
  const input = '🏡 ' + (await fixture()).input.text;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/workspace/lab/run', async route => { await gate; await route.continue(); });
  await page.getByLabel('Văn bản bài đăng', { exact: true }).fill(input);
  const response = page.waitForResponse(value => value.url().endsWith('/api/workspace/lab/run'));
  await page.getByRole('button', { name: 'Chạy đối chiếu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đang đối chiếu…' })).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'Đang chạy Regex' })).toBeVisible();
  await screenshot(page, 'lab-pending', [1440]); release();
  const received = await response; expect(received.status()).toBe(200); const data = await received.json();
  expect(data.rows.find((row: { method: string }) => row.method === 'llm').available).toBe(false);
  for (const span of data.rows.find((row: { method: string }) => row.method === 'regex').evidence) {
    expect(Array.from(data.text).slice(span.start, span.end).join('')).toBe(span.quote);
  }
  const regex = page.getByRole('region', { name: 'Bằng chứng Regex', exact: true });
  await expect(regex.locator('button[data-label=PRICE]').first()).toContainText('5tr5/th/phòng');
  await page.getByRole('button', { name: 'Giá thuê', exact: true }).click();
  await expect(regex.locator('button[data-label=PRICE]').first()).toHaveAttribute('aria-pressed', 'true');
  await regex.locator('button[data-label=PRICE]').first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Offset Unicode' })).toContainText('5tr5/th/phòng');
  await screenshot(page, 'lab-live-result');
  await page.getByRole('button', { name: 'Bỏ chọn bằng chứng' }).click();
  const bio = page.locator('summary').filter({ hasText: 'Bảng token BIO' });
  await bio.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('table').filter({ hasText: 'B-PRICE' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bảng token BIO', exact: true }).getByText('Chưa có', { exact: true }).first()).toBeVisible();
  await screenshot(page, 'lab-bio-open', [768]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await screenshot(page, 'lab-reduced-focus', [390]);
  expect(errors).toEqual([]);
});

for (const [name, expected] of [
  ['F02-hidden-price', 'Bài không công khai giá'],
  ['F03-per-person', '/người'],
  ['F04-multi-listing', 'Tin 2:'],
  ['F05-starting-from-range', 'Từ 4 tr'],
  ['F06-seeking', 'Không có listing trong kết quả.'],
] as const) {
  test('real Lab preserves fixture display: ' + name, async ({ page }) => {
    await session(page); await page.goto('/team/kiem-tra');
    const data = await runText(page, (await fixture(name)).input.text);
    const values = page.getByRole('region', { name: 'Bảng giá trị chuẩn hóa', exact: true });
    await expect(values).toContainText(expected);
    if (name === 'F03-per-person') await expect(values).not.toContainText('3 tr');
    if (name === 'F06-seeking') {
      expect(data.post_type).toBe('seeking'); expect(data.listings.regex).toEqual([]);
      // Lab keeps raw Regex spans even when classification excludes all rental listings.
      const count = data.rows.find((row: { method: string }) => row.method === 'regex').evidence.length;
      await expect(page.getByRole('region', { name: 'Bằng chứng Regex', exact: true })).toContainText(count + ' đoạn bằng chứng');
    }
  });
}

test('real stored post, missing gold, invalid input, and API failure retry keep input', async ({ page, request }) => {
  const id = await storedPost(request);
  await session(page); await page.goto('/team/kiem-tra');
  await page.getByRole('button', { name: 'Chạy đối chiếu', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Nhập văn bản');
  await page.getByLabel('Bài có sẵn (post_id)', { exact: true }).check();
  await page.getByLabel('Mã bài (post_id)', { exact: true }).fill(id);
  await page.getByRole('button', { name: 'Chạy đối chiếu', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Bằng chứng Nhãn chuẩn', exact: true })).toContainText('API xác nhận bài này chưa có nhãn chuẩn.');
  await page.getByLabel('Mã bài (post_id)', { exact: true }).fill('missing-research-post');
  await page.getByRole('button', { name: 'Chạy đối chiếu', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Mã bài (post_id)', { exact: true })).toHaveValue('missing-research-post');
  await page.getByLabel('Dán văn bản', { exact: true }).check();
  const input = (await fixture()).input.text;
  await page.getByLabel('Văn bản bài đăng', { exact: true }).fill(input);
  await page.route('**/api/workspace/lab/run', route => route.fulfill({ status: 503, json: { error: { message: 'Lỗi kết nối giả lập trong kiểm thử' } } }), { times: 1 });
  await page.getByRole('button', { name: 'Chạy đối chiếu', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Lỗi kết nối giả lập');
  await expect(page.getByLabel('Văn bản bài đăng', { exact: true })).toHaveValue(input);
  await screenshot(page, 'lab-error', [390]);
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bằng chứng trên cùng nguyên văn' })).toBeVisible();
});

// Transport-only contract cases: isolated browser responses, never persisted as runs or gold.
test('gold dev permission, empty LLM, and test lock cannot leak returned gold fields', async ({ page }) => {
  await session(page);
  const sample = await fixture();
  const response = await page.request.post('/api/workspace/lab/run', { headers, data: { text: sample.input.text } });
  expect(response.status()).toBe(200); const original = await response.json();
  const post = 'contract-only-gold'; let split = 'dev'; let goldReads = 0; let denyGold = false; let emptyLlm = false;
  await page.route('**/api/workspace/lab/run', route => route.fulfill({ json: {
    ...original, post_id: post, split,
    rows: emptyLlm ? original.rows.map((row: Record<string, unknown>) => row.method === 'llm' ? { ...row, available: true, evidence: [] } : row) : original.rows,
    normalized: original.normalized.map((row: Record<string, unknown>) => ({ ...row, gold: 'LOCKED-GOLD-SENTINEL' })),
    tokens: original.tokens.map((row: Record<string, unknown>) => ({ ...row, gold: 'LOCKED-GOLD-SENTINEL' })),
  } }));
  await page.route('**/api/workspace/lab/gold/*', route => {
    goldReads++;
    if (denyGold) return route.fulfill({ status: 403, json: { error: { message: 'Gold inaccessible in contract test' } } });
    return route.fulfill({ json: { post_id: post, split: 'dev', cluster_key: 'fixture-only', adjudicated: true, expected: sample.expected,
      spans: sample.expected.listings.flatMap((listing: Record<string, any>) => [listing.rent, listing.area, listing.room, listing.location, ...listing.fees].flatMap(field => field.evidence ?? [])) } });
  });
  await page.goto('/team/kiem-tra'); await runText(page, sample.input.text);
  const gold = page.getByRole('region', { name: 'Bằng chứng Nhãn chuẩn', exact: true });
  await expect(gold.locator('button[data-label=PRICE]')).toBeVisible();
  await expect(gold).toContainText('Đã hòa giải nhãn'); expect(goldReads).toBe(1);
  split = 'test'; await runText(page, sample.input.text);
  await expect(gold).toContainText('Nhãn tập test bị khóa');
  await page.locator('summary').filter({ hasText: 'Bảng token BIO' }).click();
  await page.locator('summary').filter({ hasText: 'Chuỗi chuẩn hóa' }).click();
  await expect(page.locator('body')).not.toContainText('LOCKED-GOLD-SENTINEL');
  expect(goldReads).toBe(1);
  await screenshot(page, 'lab-test-lock-contract', [1440]);
  split = 'dev'; denyGold = true; emptyLlm = true;
  await runText(page, sample.input.text);
  await expect(gold).toContainText('API không cho phép đọc nhãn chuẩn');
  await expect(page.getByRole('region', { name: 'Bằng chứng LLM', exact: true })).toContainText('Đã chạy, không tìm thấy span.');
  expect(goldReads).toBe(2);
  await expect(page.locator('body')).not.toContainText('LOCKED-GOLD-SENTINEL');
});

test('evaluation contract: P/R/F1, zero versus null, frozen manifest, errors, stale run and missing metrics', async ({ page }) => {
  const errors = errorsOn(page); await session(page);
  const manifest = { run_id: 'contract-dev', split: 'dev', frozen: false, methods: ['regex'], gold: { n_posts: 1 }, versions: { regex: 'contract-only' } };
  const score = { precision: 0.5, recall: 1, f1: 2 / 3, support: 1, tp: 1, fp: 1, fn: 0 };
  const data = { manifest, metrics: { regex: { entities: { strict: { PRICE: score, micro: score }, partial: { PRICE: score, micro: score } },
    normalized_correct: { rent: { value: 0, n: 1 } }, correct_abstention: { area: { value: null, n: 0 } },
    price_fee_confusion: { gold_PRICE_system_FEE: 0, gold_FEE_system_PRICE: 1 }, cost: { llm_calls: 0 } } },
    error_counts: [{ method: 'regex', error_type: 'CONTRACT-ONLY', count: 2 }] };
  await page.route('**/api/workspace/eval/runs', route => route.fulfill({ json: { items: [manifest, { ...manifest, run_id: 'contract-frozen', frozen: true }] } }));
  await page.route('**/api/workspace/eval/runs/contract-dev', route => route.fulfill({ json: data }));
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/workspace/eval/runs/contract-frozen', async route => { await gate; await route.fulfill({ json: { manifest: { ...manifest, run_id: 'contract-frozen', frozen: true }, metrics: null, error_counts: [] } }); });
  await page.goto('/team/danh-gia'); await page.getByLabel('Chọn run', { exact: true }).selectOption('contract-dev');
  const summary = page.getByRole('region', { name: 'Chỉ số tổng hợp', exact: true });
  await expect(summary).toContainText('66,67%'); await expect(summary).toContainText('50%');
  const rates = page.getByRole('region', { name: 'Tỉ lệ chuẩn hóa và để trống', exact: true });
  await expect(rates.getByRole('row').filter({ hasText: 'Chuẩn hóa đúng' })).toContainText('0%');
  await expect(rates.getByRole('row').filter({ hasText: 'Để trống đúng' })).toContainText('Chưa có');
  await expect(page.getByRole('region', { name: 'Bảng lỗi tổng hợp', exact: true })).toContainText('CONTRACT-ONLY');
  await screenshot(page, 'eval-contract-run');
  await page.getByLabel('Chọn run', { exact: true }).selectOption('contract-frozen');
  await expect(summary).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Đang đọc chỉ số' })).toBeVisible(); release();
  await expect(page.getByText('Đã đóng băng', { exact: true })).toBeVisible();
  await expect(page.getByText('Run chưa có chỉ số', { exact: true })).toBeVisible();
  await expect(page.getByText('API trả bảng lỗi rỗng.', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test('evaluation error retry, 403 and expired session are separate states', async ({ page }) => {
  await session(page);
  await page.route('**/api/workspace/eval/runs', route => route.fulfill({ status: 503, json: { error: { message: 'Lỗi danh sách giả lập trong kiểm thử' } } }), { times: 1 });
  await page.goto('/team/danh-gia');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Lỗi danh sách giả lập');
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByText('Chưa có lần chạy đánh giá', { exact: true })).toBeVisible();
  await page.route('**/api/workspace/eval/runs', route => route.fulfill({ status: 403, json: { error: { message: 'Sai quyền trong kiểm thử' } } }), { times: 1 });
  await page.getByRole('button', { name: 'Tải lại danh sách' }).click();
  await expect(page.getByRole('heading', { name: 'Bạn chưa có quyền vào khu này' })).toBeVisible();
  await page.reload(); await expect(page.getByText('Chưa có lần chạy đánh giá', { exact: true })).toBeVisible();
  await page.context().clearCookies();
  await page.getByRole('button', { name: 'Tải lại danh sách' }).click();
  await expect(page).toHaveURL(/\/dang-nhap\?expired=1&next=/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập ReNER' })).toBeVisible();
});


test('legacy Lab route redirects permanently and preserves repeated query values', async ({ page, request }) => {
  const oldPath = '/team/lab?post_id=sample&tag=a&tag=b&q=%C4%91%E1%BB%8Dc+tin';
  const response = await request.get(oldPath, { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  const location = new URL(response.headers().location, origin);
  expect(location.pathname).toBe('/team/kiem-tra');
  expect(location.searchParams.getAll('tag')).toEqual(['a', 'b']);
  expect(location.searchParams.get('q')).toBe('đọc tin');
  await session(page);
  await page.goto(oldPath);
  await expect(page).toHaveURL(origin + '/team/kiem-tra' + location.search);
  await expect(page.getByRole('heading', { name: 'Kiểm tra trích xuất', exact: true })).toBeVisible();
});

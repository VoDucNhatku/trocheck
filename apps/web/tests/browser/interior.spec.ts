import { test, expect, type Page } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { AnalysisResult, ReviewDetail, ReviewQueue } from '../../src/lib/workspace/types';
const testApi = (process.env.INTERIOR_API ?? 'http://127.0.0.1:18002') + '/_test/state';
const shots = path.resolve('../../.tmp/interior-shots');
async function password() { return JSON.parse(await readFile(path.resolve('../../.tmp/interior-test-credentials.json'), 'utf8')).password as string; }
async function login(page: Page, username: string, target = '/phan-tich') {
  await page.goto('/dang-nhap?next=' + encodeURIComponent(target));
  await page.getByLabel('Tên tài khoản').fill(username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(await password());
  await page.getByRole('button', { name: 'Vào bàn làm việc' }).click();
  await expect(page).toHaveURL(new RegExp(target.split('?')[0]));
}
test.beforeAll(async () => { await mkdir(shots, { recursive: true }); });
// A failed test must not leave the worker paused: the queued analysis would 429 every later run.
test.afterEach(async ({ request }) => { await request.post(testApi, { data: { worker_paused: false } }); });

test('login, return path, server role guard, cookie and logout', async ({ page, request }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/team/duyet?reason=conflict');
  await expect(page).toHaveURL(/dang-nhap\?next=/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập ReNER' })).toBeVisible();
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(shots, 'login-' + width + '.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
  await page.getByLabel('Tên tài khoản').fill('renter');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('incorrect');
  await page.getByRole('button', { name: 'Vào bàn làm việc' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Sai tên' })).toBeVisible();
  await page.getByLabel('Mật khẩu', { exact: true }).fill(await password());
  await page.getByRole('button', { name: 'Vào bàn làm việc' }).click();
  await expect(page).toHaveURL(/team\/duyet\?reason=conflict/);
  await expect(page.getByRole('heading', { name: 'Bạn chưa có quyền vào khu này' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hàng duyệt', exact: true })).toHaveCount(0);
  const cookie = (await page.context().cookies()).find(item => item.name === 'rener_session');
  expect(cookie?.httpOnly).toBeTruthy(); expect(cookie?.sameSite).toBe('Lax');
  expect((await page.request.get('/api/workspace/team/posts')).status()).toBe(403);
  expect((await request.get('/api/workspace/https://example.com')).status()).toBe(404);
  expect((await request.post('/api/workspace/auth/logout', { data: {}, headers: { Origin: 'https://evil.example', 'X-ReNER-Request': '1' } })).status()).toBe(403);
  await page.goto('/tai-khoan'); await expect(page.getByRole('heading', { name: 'Tài khoản & kết nối' })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất phiên này' }).click();
  await expect(page).toHaveURL(/dang-nhap/);
  expect((await page.context().cookies()).some(item => item.name === 'rener_session')).toBeFalsy();
  await page.goto('/phan-tich'); await expect(page).toHaveURL(/dang-nhap/);
  expect(errors).toEqual([]);
});

test('analysis creates a real ID, queued polling, terminal result, evidence and responsive shell', async ({ page, request }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await request.post(testApi, { data: { worker_paused: true } });
  await login(page, 'renter');
  await page.getByRole('button', { name: 'Dùng bài mẫu tự tạo' }).click();
  await page.getByRole('button', { name: 'Xem nội dung sẽ gửi' }).click();
  await expect(page.getByRole('heading', { name: 'Nội dung sẽ gửi' })).toBeVisible();
  // Any Playwright action that triggers router.push never settles here (page stays usable), so fire and move on;
  // the analysis ID is then read from the URL the app navigated to.
  void page.getByRole('button', { name: 'Phân tích bài này' }).click({ timeout: 10000 }).catch(() => undefined);
  await page.waitForURL(/\/phan-tich\/[0-9A-Z]{26}$/);
  const analysisId = page.url().split('/').pop()!;
  expect((await page.request.get('/api/workspace/analyses/' + analysisId)).status()).toBe(200);
  await expect(page.getByRole('status').filter({ hasText: 'Đang chờ xử lý' })).toBeVisible();
  await request.post(testApi, { data: { worker_paused: false } });
  await expect(page.getByRole('status').filter({ hasText: 'Đã đọc xong' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Những điều bài đã nói' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đóng góp bài này' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Giá thuê \d/ }).click();
  await expect(page.getByText('Đoạn chọn:', { exact: false })).toContainText('4tr8');
  await expect(page.getByRole('heading', { name: 'Đặt cọc', exact: true })).toBeVisible();
  await expect(page.getByText('Giá chào thuê cao hơn trung vị nhóm khoảng', { exact: false })).toContainText(/\d+,\d%/);
  const contrast = await page.locator('[data-label] > span[aria-hidden=true]').evaluateAll(elements => elements.map(element => {
    const foreground = getComputedStyle(element).color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const mark = getComputedStyle(element.parentElement!);
    const background = mark.backgroundColor.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = (rgb: number[]) => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const a = luminance(foreground); const b = luminance(background);
    return { label: element.textContent, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), opacity: mark.opacity };
  }));
  expect(contrast.length).toBeGreaterThan(0);
  for (const row of contrast) { expect(row.ratio).toBeGreaterThanOrEqual(4.5); expect(row.opacity).toBe('1'); }
  console.log('Evidence label contrast:', contrast.map(row => row.label + '=' + row.ratio.toFixed(2)).join(', '));
  await page.waitForTimeout(1200);
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(shots, 'reading-' + width + '.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
  await page.getByRole('button', { name: 'Mở điều hướng' }).click();
  await expect(page.getByRole('dialog', { name: 'Điều hướng' })).toBeVisible();
  await page.screenshot({ path: path.join(shots, 'drawer-360.png'), fullPage: true });
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở điều hướng' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('extension token is shown once and revocation uses real API', async ({ page }) => {
  await login(page, 'renter', '/tai-khoan');
  await expect(page.getByRole('heading', { name: 'Các kết nối của bạn' })).toBeVisible();
  await page.getByLabel('Tên kết nối (tùy chọn)').fill('Trình duyệt kiểm thử');
  await page.getByRole('button', { name: 'Tạo mã kết nối' }).click();
  await expect(page.locator('[data-sensitive]')).toBeVisible();
  await page.getByRole('button', { name: 'Ẩn mã', exact: true }).click();
  await page.reload(); await expect(page.locator('[data-sensitive]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Thu hồi', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Thu hồi', exact: true }).first().click();
  await page.getByRole('button', { name: 'Thu hồi mã', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã thu hồi kết nối.' })).toBeVisible();
});

const mutationHeaders = { 'X-ReNER-Request': '1', Origin: process.env.INTERIOR_WEB ?? 'http://127.0.0.1:3009' };
async function reviewerSession(page: Page) {
  await page.goto('/dang-nhap');
  const response = await page.request.post('/api/workspace/auth/login', { headers: mutationHeaders, data: { username: 'reviewer', password: await password() } });
  expect(response.status()).toBe(200);
}
async function createReview(page: Page) {
  const response = await page.request.post('/api/workspace/analyses', { headers: mutationHeaders, data: {
    idempotency_key: 'review-browser:' + crypto.randomUUID(), source_type: 'fixture', phone_masked: true, text_complete: true,
    text: '🏠 Cho thuê phòng trọ 26m2. Giá 3tr2/tháng. Điện 3k5/số, nước 100k/người/tháng. Cọc 1 tháng tiền thuê. Bài tự tạo kiểm thử ' + crypto.randomUUID(),
  } });
  expect(response.status()).toBe(202);
  const created = await response.json();
  let result: AnalysisResult | undefined;
  await expect.poll(async () => {
    const response = await page.request.get('/api/workspace/analyses/' + created.analysis_id);
    result = await response.json(); return result?.status;
  }, { timeout: 30000 }).toBe('succeeded');
  expect(result!.is_demo).toBe(true); expect(result!.listings.length).toBeGreaterThan(0);
  const id = result!.listings[0].listing_id;
  const detail = await page.request.get('/api/workspace/team/reviews/' + id);
  expect(detail.status()).toBe(200);
  return { id, detail: await detail.json() as ReviewDetail, analysisId: created.analysis_id as string };
}
async function capture(page: Page, name: string, widths = [1440, 768, 390]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(shots, name + '-' + width + '.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
}

test('reviewer opens a real queue ID; interior pages fit desktop, tablet and phone', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await login(page, 'reviewer', '/team/duyet');
  const fixture = await createReview(page);
  for (const [url, heading, name] of [
    ['/thi-truong?demo=true', 'Một mặt bằng giá có căn cứ', 'market'],
    ['/team/kho', 'Kho dữ liệu bài đăng', 'store'],
    ['/tai-khoan', 'Tài khoản & kết nối', 'account'],
    ['/team/duyet', 'Những tin cần một lượt đọc', 'queue'],
  ]) {
    await page.goto(url); await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Đang đọc dữ liệu' })).toHaveCount(0);
    await capture(page, name);
  }
  const queue = await (await page.request.get('/api/workspace/team/reviews?page_size=200')).json() as ReviewQueue;
  expect(queue.items.some(item => item.listing_id === fixture.id)).toBe(true);
  const link = page.getByRole('link', { name: 'Mở để duyệt' }).first();
  const href = await link.getAttribute('href'); expect(href).toMatch(/^\/team\/duyet\/[0-9A-Z]{26}$/);
  await link.click(); await expect(page).toHaveURL(new RegExp(href! + '$'));
  await expect(page.getByRole('heading', { name: 'Bài gốc & bằng chứng' })).toBeVisible();
  await page.goto('/team/duyet/' + fixture.id);
  await expect(page.getByRole('heading', { name: 'Đối chiếu & giá trị chọn' })).toBeVisible();
  await capture(page, 'review');
  await page.setViewportSize({ width: 1440, height: 1000 });
  // The shell uses landing paper; page interiors keep their current tokens.
  const background = await page.locator('[data-workspace]').first().evaluate(element => getComputedStyle(element).backgroundColor);
  expect(background).toBe('rgb(244, 241, 234)');
  await page.getByRole('button', { name: 'Chấp nhận tin', exact: true }).focus();
  expect(await page.getByRole('button', { name: 'Chấp nhận tin', exact: true }).evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
  await page.screenshot({ path: path.join(shots, 'review-focus-1440.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('renter direct detail URL renders Forbidden and protected API returns 403', async ({ page }) => {
  await login(page, 'renter');
  const forbiddenPath = '/team/duyet/00000000000000000000000000';
  await page.goto(forbiddenPath);
  await expect(page.getByRole('heading', { name: 'Bạn chưa có quyền vào khu này' })).toBeVisible();
  expect((await page.request.get('/api/workspace/team/reviews/00000000000000000000000000')).status()).toBe(403);
  expect((await page.request.post('/api/workspace/team/reviews/00000000000000000000000000/decision', { headers: mutationHeaders, data: { action: 'approve', expected_version: 1 } })).status()).toBe(403);
});

test('approve saves edited fields and loaded version once through the real API', async ({ page }) => {
  await reviewerSession(page); const { id, detail } = await createReview(page);
  await page.goto('/team/duyet/' + id);
  await page.getByText('Sửa diện tích', { exact: true }).click();
  await page.getByLabel('Diện tích cụ thể (m²)', { exact: true }).fill('26.5');
  await page.getByText('Sửa giá thuê', { exact: true }).click();
  await page.getByLabel('Cơ sở tính giá', { exact: true }).selectOption('unknown');
  await page.getByText('Sửa phí và đặt cọc', { exact: true }).click();
  await page.getByLabel('Số tiền (đồng)', { exact: true }).first().fill('3600');
  const requests: Record<string, unknown>[] = [];
  page.on('request', request => { if (request.url().endsWith('/decision')) requests.push(request.postDataJSON()); });
  await page.getByRole('button', { name: 'Chấp nhận tin', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Xác nhận chấp nhận tin' }).click();
  await expect(page).toHaveURL(/\/team\/duyet\?decision=approve/);
  expect(requests).toHaveLength(1); expect(requests[0].expected_version).toBe(detail.version);
  expect(Object.keys(requests[0]).sort()).toEqual(['action', 'expected_version', 'fields']);
  const saved = await (await page.request.get('/api/workspace/team/reviews/' + id)).json() as ReviewDetail;
  expect(saved.review_status).toBe('approved'); expect(saved.version).toBe(detail.version + 1);
  expect(saved.listing.area.value_m2).toBe(26.5); expect(saved.listing.fees[0].amount_vnd).toBe(3600);
});

test('reject requires a reason; cancel and unsaved navigation never write a decision', async ({ page }) => {
  await reviewerSession(page); const { id, detail } = await createReview(page);
  await page.goto('/team/duyet/' + id);
  const requests: unknown[] = [];
  page.on('request', request => { if (request.url().endsWith('/decision')) requests.push(request.postDataJSON()); });
  await page.getByRole('button', { name: 'Loại tin', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Xác nhận loại tin' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Hãy nhập lý do loại tin.'); expect(requests).toHaveLength(0);
  await capture(page, 'review-reject-required', [1440, 390]);
  await dialog.getByRole('button', { name: 'Hủy, tiếp tục đọc' }).click();
  await page.getByLabel('Lý do (bắt buộc khi loại tin)').fill('Bài tự tạo không còn phù hợp');
  await page.getByRole('link', { name: 'Về hàng duyệt' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Rời tin khi chưa lưu?' })).toBeVisible();
  await page.screenshot({ path: path.join(shots, 'review-unsaved-390.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Ở lại đọc tiếp' }).click();
  await expect(page).toHaveURL(new RegExp(id + '$'));
  const blocked = await page.request.post('/api/workspace/team/reviews/' + id + '/decision', { headers: mutationHeaders, data: { action: 'reject', expected_version: detail.version } });
  expect(blocked.status()).toBe(422);
  expect((await (await page.request.get('/api/workspace/team/reviews/' + id)).json()).version).toBe(detail.version);
  await page.getByRole('button', { name: 'Loại tin', exact: true }).click();
  const response = page.waitForResponse(response => response.url().endsWith('/decision'));
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận loại tin' }).click();
  expect((await response).status()).toBe(200); await expect(page).toHaveURL(/decision=reject/);
  const saved = await (await page.request.get('/api/workspace/team/reviews/' + id)).json();
  expect(saved.review_status).toBe('rejected'); expect(saved.history.at(-1).reason).toBe('Bài tự tạo không còn phù hợp');
});

test('409 retains local edits, reloads latest values and requires explicit adoption', async ({ page }) => {
  await reviewerSession(page); const { id, detail } = await createReview(page);
  await page.goto('/team/duyet/' + id);
  await page.getByText('Sửa diện tích', { exact: true }).click();
  await page.getByLabel('Diện tích cụ thể (m²)', { exact: true }).fill('27');
  const competing = await page.request.post('/api/workspace/team/reviews/' + id + '/decision', { headers: mutationHeaders, data: { action: 'approve', expected_version: detail.version, fields: { area: { value_m2: 28 } }, reason: 'Bản kiểm thử cạnh tranh' } });
  expect(competing.status()).toBe(200);
  await page.getByRole('button', { name: 'Chấp nhận tin', exact: true }).click();
  const response = page.waitForResponse(response => response.url().endsWith('/decision'));
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận chấp nhận tin' }).click();
  expect((await response).status()).toBe(409);
  await expect(page.getByRole('heading', { name: 'Tin đã được sửa. Chưa lưu quyết định của bạn.' })).toBeVisible();
  await expect(page.getByText('Diện tích · Diện tích cụ thể (m²): 26 → 28', { exact: false })).toBeVisible();
  await expect(page.getByText('Diện tích · Diện tích cụ thể (m²): 26 → 27', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Diện tích cụ thể (m²)', { exact: true })).toHaveValue('27');
  await expect(page.getByRole('button', { name: 'Chấp nhận tin', exact: true })).toBeDisabled();
  await capture(page, 'review-conflict', [1440, 390]);
  await page.getByRole('button', { name: 'Dùng bản mới và bỏ sửa đổi cũ' }).click();
  await expect(page.getByLabel('Diện tích cụ thể (m²)', { exact: true })).toHaveValue('28');
  await expect(page.getByRole('button', { name: 'Chấp nhận tin', exact: true })).toBeEnabled();
  expect((await (await page.request.get('/api/workspace/team/reviews/' + id)).json()).version).toBe(detail.version + 1);
});

test('merge validates target, cancel is inert, split changes only the duplicate cluster', async ({ page }) => {
  await reviewerSession(page); const source = await createReview(page); const target = await createReview(page);
  await page.goto('/team/duyet/' + source.id);
  await page.getByRole('button', { name: 'Gộp vào cụm trùng', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Xác nhận gộp vào cụm trùng' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Hãy chọn hoặc nhập cụm đích.');
  const invalid = await page.request.post('/api/workspace/team/reviews/' + source.id + '/decision', { headers: mutationHeaders, data: { action: 'merge', expected_version: source.detail.version } });
  expect(invalid.status()).toBe(422); expect((await invalid.json()).error.field_errors.merge_into_cluster).toBeTruthy();
  await dialog.getByRole('button', { name: 'Hủy, tiếp tục đọc' }).click();
  await page.getByRole('button', { name: 'Tách khỏi cụm trùng', exact: true }).click();
  dialog = page.getByRole('dialog'); await expect(dialog).toContainText('Không tạo thêm tin');
  await page.keyboard.press('Escape');
  expect((await (await page.request.get('/api/workspace/team/reviews/' + source.id)).json()).version).toBe(source.detail.version);
  await page.getByRole('button', { name: 'Tách khỏi cụm trùng', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận tách khỏi cụm trùng' }).click();
  await expect(page).toHaveURL(/decision=split/);
  const split = await (await page.request.get('/api/workspace/team/reviews/' + source.id)).json() as ReviewDetail;
  expect(split.cluster_id).not.toBe(source.detail.cluster_id); expect(split.listing).toEqual(source.detail.listing);
  await page.goto('/team/duyet/' + source.id);
  await page.getByLabel('Cụm đích khi gộp trùng').fill(target.detail.cluster_id!);
  await page.getByRole('button', { name: 'Gộp vào cụm trùng', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận gộp vào cụm trùng' }).click();
  await expect(page).toHaveURL(/decision=merge/);
  const merged = await (await page.request.get('/api/workspace/team/reviews/' + source.id)).json() as ReviewDetail;
  expect(merged.cluster_id).toBe(target.detail.cluster_id); expect(merged.review_status).toBe('duplicate');
});

test('in-flight decision keeps button size, blocks double submit and only navigates after success', async ({ page }) => {
  await reviewerSession(page); const { id, detail } = await createReview(page);
  await page.goto('/team/duyet/' + id);
  await page.getByRole('button', { name: 'Chấp nhận tin', exact: true }).click();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let requestCount = 0;
  await page.route('**/team/reviews/' + id + '/decision', async route => { requestCount++; await held; await route.continue(); });
  const button = page.getByRole('dialog').getByRole('button', { name: 'Xác nhận chấp nhận tin' });
  const before = await button.boundingBox(); await button.click();
  const pending = page.getByRole('dialog').getByRole('button', { name: 'Đang lưu quyết định…' });
  await expect(pending).toBeDisabled(); await expect(pending).toHaveAttribute('aria-busy', 'true');
  const after = await pending.boundingBox(); expect(after!.width).toBe(before!.width); expect(after!.height).toBe(before!.height);
  await pending.evaluate(element => (element as HTMLButtonElement).click());
  expect(requestCount).toBe(1); await expect(page).toHaveURL(new RegExp(id + '$'));
  await page.screenshot({ path: path.join(shots, 'review-saving-1440.png'), fullPage: true });
  release(); await expect(page).toHaveURL(/decision=approve/);
  expect((await (await page.request.get('/api/workspace/team/reviews/' + id)).json()).version).toBe(detail.version + 1);
});

test('failed decision stays editable; missing detail has a readable error and public detail still works', async ({ page }) => {
  await reviewerSession(page); const { id } = await createReview(page);
  await page.goto('/team/duyet/' + id);
  await page.route('**/team/reviews/' + id + '/decision', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Kết nối kiểm thử bị gián đoạn' } }) }));
  await page.getByRole('button', { name: 'Chấp nhận tin', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận chấp nhận tin' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Kết nối kiểm thử bị gián đoạn');
  await expect(page).toHaveURL(new RegExp(id + '$'));
  await page.screenshot({ path: path.join(shots, 'review-save-error-1440.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.goto('/team/duyet/00000000000000000000000000');
  await expect(page.getByRole('alert')).toBeVisible();
  await capture(page, 'review-not-found', [1440, 390]);
  const listings = await (await page.request.get((process.env.INTERIOR_API ?? 'http://127.0.0.1:18003') + '/api/v1/listings?demo=true')).json();
  expect(listings.items.length).toBeGreaterThan(0);
  await page.goto('/tin/' + listings.items[0].listing_id + '?demo=true');
  await expect(page.locator('main')).toBeVisible(); await expect(page.locator('[data-label]').first()).toBeVisible();
  await capture(page, 'public-evidence', [1440, 390]);
});

test('review keyboard, unsaved Back/reload, reduced motion and interior empty states', async ({ page }) => {
  await reviewerSession(page); const { id, analysisId } = await createReview(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/team/duyet/' + id);
  const approve = page.getByRole('button', { name: 'Chấp nhận tin', exact: true });
  await approve.hover();
  expect(await approve.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(25, 60, 46)');
  expect(await approve.evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
  await page.screenshot({ path: path.join(shots, 'review-hover-1440.png'), fullPage: true });
  await page.getByLabel('Lý do (bắt buộc khi loại tin)').fill('Bản nháp để kiểm tra điều hướng');
  let unloadSeen = false;
  page.once('dialog', async dialog => { unloadSeen = dialog.type() === 'beforeunload'; await dialog.dismiss(); });
  // A cancelled reload has no completed navigation for Playwright to wait for.
  void page.evaluate(() => window.location.reload()).catch(() => undefined);
  await expect.poll(() => unloadSeen).toBe(true);
  await expect(page.getByLabel('Lý do (bắt buộc khi loại tin)')).toHaveValue('Bản nháp để kiểm tra điều hướng');
  void page.goBack().catch(() => undefined);
  await expect(page.getByRole('dialog', { name: 'Rời tin khi chưa lưu?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Loại tin', exact: true }).click();
  const dialog = page.getByRole('dialog');
  expect(await dialog.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  console.log('Review dialog focus:', await dialog.evaluate(element => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id, hasFocus: document.hasFocus(), open: (element as HTMLDialogElement).open, autofocus: element.querySelector('button')?.autofocus })));
  await page.screenshot({ path: path.join(shots, 'review-keyboard-dialog-1440.png'), fullPage: true });
  await expect(dialog.getByRole('button', { name: 'Hủy, tiếp tục đọc' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Loại tin', exact: true })).toBeFocused();
  await page.getByLabel('Lý do (bắt buộc khi loại tin)').fill('');
  await page.goto('/team/kho?collector=codex2-no-such-collector');
  await expect(page.getByText('Chưa có bài khớp bộ lọc', { exact: true })).toBeVisible();
  await capture(page, 'store-empty', [1440, 390]);
  await page.goto('/team/duyet?reason=llm_error');
  await expect(page.getByText('Không có tin đang chờ ở lựa chọn này', { exact: true })).toBeVisible();
  await capture(page, 'queue-empty', [1440, 390]);
  await page.goto('/phan-tich/' + analysisId);
  await expect(page.getByText('Chưa đủ dữ liệu để kết luận:', { exact: false })).toBeVisible();
  await expect(page.getByText(/^Trung vị \d/)).toHaveCount(0);
  await capture(page, 'reading-insufficient', [1440, 390]);
});

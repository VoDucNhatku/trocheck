import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { AnalysisResult, ReviewQueue } from '../../src/lib/workspace/types';
const base = process.env.INTERIOR_WEB ?? 'http://127.0.0.1:3011';
const headers = { Origin: base, 'X-ReNER-Request': '1' };
const shots = path.resolve('../../.tmp/redesign-shots');
test.beforeAll(async () => { await mkdir(shots, { recursive: true }); });

test('registration validates locally, holds pending size, creates renter and preserves a safe return', async ({ page }) => {
  await page.goto('/dang-ky?next=%2Ftai-khoan');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.locator('#username')).toBeFocused();
  await expect(page.locator('#accept_terms-error')).toBeVisible();
  const username = ('student_' + Date.now()).padEnd(30, 'x');
  await page.getByLabel('Tên tài khoản', { exact: true }).fill(username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('ExamplePass7');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('ExamplePass8');
  await page.getByLabel('Tôi đồng ý', { exact: false }).check();
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.locator('#confirm_password-error')).toHaveText('Mật khẩu nhập lại chưa khớp.');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('ExamplePass7');
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
  await expect(page.locator('#password')).toHaveAttribute('type', 'text');
  await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', '3');
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; }); let requests = 0;
  await page.route('**/auth/register', async route => { requests++; await held; await route.continue(); });
  const submit = page.getByRole('button', { name: 'Tạo tài khoản', exact: true }); const before = await submit.boundingBox();
  await submit.click(); const pending = page.getByRole('button', { name: 'Đang tạo tài khoản…' });
  await expect(pending).toBeDisabled(); const after = await pending.boundingBox();
  expect(after?.width).toBe(before?.width); expect(after?.height).toBe(before?.height);
  await pending.evaluate(element => (element as HTMLButtonElement).click());
  await page.screenshot({ path: path.join(shots, 'auth-pending-final.png'), fullPage: true });
  release(); await expect(page).toHaveURL(/\/tai-khoan$/); expect(requests).toBe(1);
  const me = await (await page.request.get('/api/workspace/auth/me')).json(); expect(me.roles).toEqual(['renter']); expect(me.username).toBe(username);
  expect((await page.request.get('/api/workspace/team/reviews')).status()).toBe(403);
  expect((await page.context().cookies()).find(c => c.name === 'rener_session')?.httpOnly).toBe(true);
});

test('duplicate registration maps to username, hostile return is removed, BFF rejects cross-origin and extra roles', async ({ page, request }) => {
  await page.goto('/dang-ky?next=https%3A%2F%2Fevil.example');
  await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true })).toHaveAttribute('href', '/dang-nhap?next=%2Fphan-tich');
  await page.getByLabel('Tên tài khoản', { exact: true }).fill('admin');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('ExamplePass7');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('ExamplePass7');
  await page.getByLabel('Tôi đồng ý', { exact: false }).check();
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.locator('#username-error')).toContainText('tài khoản'); await expect(page.locator('#username')).toBeFocused();
  await page.screenshot({ path: path.join(shots, 'auth-duplicate-final.png'), fullPage: true });
  const data = { username: 'invalid_roles', password: 'ExamplePass7', confirm_password: 'ExamplePass7', accept_terms: true, roles: ['admin'] };
  expect((await request.post('/api/workspace/auth/register', { headers: { ...headers, Origin: 'https://evil.example' }, data })).status()).toBe(403);
  expect((await request.post('/api/workspace/auth/register', { headers, data })).status()).toBe(422);
});

test('account popover works with keyboard, outside click and real logout', async ({ page }) => {
  const password = JSON.parse(await readFile(path.resolve('../../.tmp/interior-test-credentials.json'), 'utf8')).password;
  expect((await page.request.post('/api/workspace/auth/login', { headers, data: { username: 'admin', password } })).status()).toBe(200);
  await page.goto('/phan-tich');
  const trigger = page.getByRole('button', { name: 'Menu tài khoản' });
  await trigger.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#account-popover').getByRole('link', { name: 'Tài khoản', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused(); await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click(); await page.getByRole('heading', { name: 'Đọc kỹ một bài đăng' }).click(); await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click(); await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(/dang-nhap/); expect((await page.request.get('/api/workspace/auth/me')).status()).toBe(401);
});

test('reading handles long Vietnamese text, large rent, ranges and null without overflow', async ({ page }) => {
  const password = JSON.parse(await readFile(path.resolve('../../.tmp/interior-test-credentials.json'), 'utf8')).password;
  await page.request.post('/api/workspace/auth/login', { headers, data: { username: 'admin', password } });
  const created = await (await page.request.post('/api/workspace/analyses', { headers, data: { idempotency_key: 'layout:' + crypto.randomUUID(), source_type: 'fixture', phone_masked: true, text_complete: true, text: 'Cho thuê phòng trọ 26m2. Giá 3tr2/tháng. Điện 3k5/số, nước 100k/người/tháng. Cọc 1 tháng.' } })).json();
  const fixture = { analysisId: created.analysis_id };
  let original: AnalysisResult;
  await expect.poll(async () => { original = await (await page.request.get('/api/workspace/analyses/' + fixture.analysisId)).json(); return original.status; }, { timeout: 30000 }).toBe('succeeded');
  // Contract-shaped demo variants enter through the response boundary; nothing writes these values to the API.
  let mode = 'long';
  await page.route('**/api/workspace/analyses/' + fixture.analysisId, route => {
    const value = structuredClone(original), listing = value.listings[0];
    value.text = '🏠 Cho thuê phòng có gác. Giá 12.500.000 đ/tháng/phòng. Phường Nguyễn Thái Bình. ' + 'Phòng thoáng, giờ giấc tự do; nhờ xác nhận điều kiện thuê, chỗ để xe và khoản đặt cọc. '.repeat(25);
    listing.rent = { ...listing.rent, evidence: [], amount_form: mode === 'range' ? 'range' : mode === 'null' ? 'none' : 'exact', amount_vnd: mode === 'long' ? 12500000 : null, min_vnd: mode === 'range' ? 12000000 : null, max_vnd: mode === 'range' ? 12500000 : null, basis: 'per_unit', period: 'month', visibility: mode === 'null' ? 'hidden_explicit' : 'disclosed' };
    listing.location.ward_name = 'Phường Nguyễn Thái Bình'; listing.location.evidence = [];
    return route.fulfill({ json: value });
  });
  for (mode of ['long', 'range', 'null']) {
    await page.goto('/phan-tich/' + fixture.analysisId + '?data=' + mode);
    await expect(page.getByRole('heading', { name: 'Những điều bài đã nói' })).toBeVisible();
    for (const width of [1440, 1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    if (mode === 'long') await expect(page.getByRole('button', { name: /^Giá thuê 12\.500\.000/ })).toBeVisible();
    if (mode === 'null') await expect(page.getByRole('button', { name: /^Giá thuê/ })).not.toContainText('0 đ');
    await page.screenshot({ path: path.join(shots, 'reading-worst-' + mode + '-360.png'), fullPage: true });
  }
});

test('queue zero, one and 200 results keep truthful counts and server pagination', async ({ page }) => {
  const password = JSON.parse(await readFile(path.resolve('../../.tmp/interior-test-credentials.json'), 'utf8')).password;
  await page.request.post('/api/workspace/auth/login', { headers, data: { username: 'reviewer', password } });
  const original = await (await page.request.get('/api/workspace/team/reviews?page_size=20')).json() as ReviewQueue;
  expect(original.items.length).toBeGreaterThan(0);
  let count = 0;
  await page.route('**/api/workspace/team/reviews?*', route => route.fulfill({ json: {
    ...original, total: count, counts: { basis_unknown: count },
    items: Array.from({ length: Math.min(count, 20) }, (_, i) => ({ ...original.items[0], listing_id: String(i).padStart(26, '0'), ward_name: 'Phường Nguyễn Thái Bình' })),
  } }));
  for (count of [0, 1, 200]) {
    await page.goto('/team/duyet?data=' + count);
    if (count === 0) await expect(page.getByText('Hàng duyệt đang trống', { exact: true })).toBeVisible();
    else await expect(page.getByRole('link', { name: 'Mở để duyệt' })).toHaveCount(Math.min(count, 20));
    if (count === 200) await expect(page.getByRole('link', { name: 'Trang sau' })).toBeVisible();
    for (const width of [1440, 768, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: path.join(shots, 'queue-worst-' + count + '-360.png'), fullPage: true });
  }
});

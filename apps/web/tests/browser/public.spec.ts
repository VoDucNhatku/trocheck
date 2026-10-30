import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const api = process.env.PUBLIC_API ?? 'http://127.0.0.1:18000';
const evidence = path.resolve('../../.tmp/b1-ui-evidence');
async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true });
}
test.beforeEach(async ({ request, page }) => {
  await request.post(`${api}/_test/state`, { data: { mode: 'ok' } });
  page.on('pageerror', (error) => {
    throw error;
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrat|did not match|server rendered/i.test(message.text()))
      throw new Error(message.text());
  });
});
test.afterEach(async ({ request }) => {
  await request.post(`${api}/_test/state`, { data: { mode: 'ok' } });
});

test('seed -> real listing IDs -> evidence and comparison match API', async ({ page, request }) => {
  const listings = await (await request.get(`${api}/api/v1/listings`)).json();
  expect(listings.total).toBeGreaterThan(20);
  await page.goto('/tim-tro');
  await expect(page.locator('a[href^="/tin/"]')).toHaveCount(20);
  const first = listings.items[0];
  const link = page.locator(`a[href="/tin/${first.listing_id}?demo=true"]`);
  await expect(link).toBeVisible();
  await screenshot(page, 'listings-desktop');
  await link.click();
  await expect(page.getByRole('heading', { name: 'Bằng chứng', exact: true })).toBeVisible();
  const detail = await (await request.get(`${api}/api/v1/listings/${first.listing_id}`)).json();
  const c = await (await request.get(`${api}/api/v1/listings/${first.listing_id}/comparison`)).json();
  await expect(page.getByText(c.message, { exact: true })).toBeVisible();
  expect(detail.listing.listing_id).toBe(first.listing_id);
  if (detail.listing.rent.evidence.length) {
    await page.getByRole('button', { name: /GIÁ Giá thuê/ }).click();
    await expect(page.locator('button[data-label="PRICE"][aria-pressed="true"]').first()).toBeVisible();
  }
  await screenshot(page, 'detail-evidence');
  const home = await (await request.get(`${api}/api/v1/stats/overview`)).json();
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Số liệu kho' })).toContainText(String(home.total_listings));
  await screenshot(page, 'home-desktop');
});

test('pagination preserves repeated filters; filter and sort return to page one', async ({ page }) => {
  const query = new URLSearchParams({ demo: 'true' });
  for (const ward of ['Phường Cầu Giấy', 'Phường Yên Hòa']) query.append('phuong', ward);
  for (const type of ['ccmn', 'phong_tro']) query.append('loai', type);
  await page.goto(`/tim-tro?${query}`);
  await page.getByRole('link', { name: 'Trang sau', exact: true }).click();
  await expect(page).toHaveURL(/trang=2/);
  expect(new URL(page.url()).searchParams.getAll('phuong')).toHaveLength(2);
  expect(new URL(page.url()).searchParams.getAll('loai')).toHaveLength(2);
  await screenshot(page, 'pagination');
  await page.getByRole('combobox', { name: 'Sắp xếp' }).selectOption('price_asc');
  await expect(page).not.toHaveURL(/trang=/);
  await page.getByRole('link', { name: 'Trang sau', exact: true }).click();
  await page.getByRole('button', { name: 'Căn hộ dịch vụ', exact: true }).click();
  await expect(page).not.toHaveURL(/trang=/);
});

test('hidden count, zero results and removable filters', async ({ page, request }) => {
  const expected = await (await request.get(`${api}/api/v1/listings?price_max=4000000`)).json();
  await page.goto('/tim-tro?gia_max=4');
  await expect(page.getByText(new RegExp(`${expected.hidden_no_price} tin không có giá cụ thể bị ẩn`))).toBeVisible();
  await page.goto('/tim-tro?gia_min=99999&trang=3&demo=true');
  await expect(page.getByRole('heading', { name: 'Không có tin nào khớp đủ các điều kiện' })).toBeVisible();
  await screenshot(page, 'no-results');
  await page.getByRole('link', { name: /Giá từ 99999 tr/ }).click();
  await expect(page).not.toHaveURL(/trang=|gia_min=/);
  await expect(page.locator('a[href^="/tin/"]')).toHaveCount(20);
});

test('range/from/person/hidden, emoji, null dates and incomplete text', async ({ page, request }) => {
  const { edges } = await (await request.get(`${api}/_test/state`)).json();
  for (const key of ['range', 'from', 'person', 'hidden', 'emoji', 'partial']) {
    await page.goto(`/tin/${edges[key]}?demo=true`);
    await expect(page.getByRole('heading', { name: 'Bằng chứng', exact: true })).toBeVisible();
    await expect(page.getByText('Chưa rõ ngày đăng', { exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Invalid Date');
    if (key === 'range') await expect(page.getByRole('button', { name: /GIÁ Giá thuê/ })).toContainText('3 tr–3,5 tr');
    if (key === 'from') await expect(page.getByRole('button', { name: /GIÁ Giá thuê/ })).toContainText('Từ 3 tr');
    if (key === 'person')
      await expect(page.getByRole('button', { name: /GIÁ Giá thuê/ })).toContainText('/tháng/người');
    if (key === 'hidden')
      await expect(page.getByRole('button', { name: /GIÁ Giá thuê/ })).toContainText('Bài không công khai giá');
    if (key === 'partial') await expect(page.getByText('Chữ chưa đầy đủ', { exact: true })).toBeVisible();
    if (key === 'emoji') {
      await expect(page.locator('button[data-label="PRICE"]').first()).toContainText('5tr5');
      await page.getByRole('button', { name: /GIÁ Giá thuê/ }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('button[data-label="PRICE"][aria-pressed="true"]').first()).toBeVisible();
      await screenshot(page, 'emoji-keyboard');
    }
  }
});

test('empty dataset, demo on/off, missing ID produces 404', async ({ page, request }) => {
  await page.goto('/tim-tro?demo=false');
  await expect(page.getByRole('heading', { name: 'Kho chưa có tin' })).toBeVisible();
  await screenshot(page, 'empty-warehouse');
  await page.goto('/?demo=false');
  await expect(page.getByRole('heading', { name: /Đọc đúng/, level: 1 })).toBeVisible();
  await expect(page.getByText(/Kho chưa có tin/)).toBeVisible();
  await request.post(`${api}/_test/state`, { data: { mode: 'ok', demo_mode: false } });
  await page.goto('/tim-tro?demo=true');
  await expect(page.getByText('Đang xem kho dữ liệu thật')).toBeVisible();
  const response = await page.goto('/tin/b1-missing?demo=true');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Không tìm thấy tin' })).toBeVisible();
  await screenshot(page, 'not-found');
});

test('API error and timeout have retry; homepage illustration survives failure', async ({ page, request }) => {
  await request.post(`${api}/_test/state`, { data: { mode: 'fail' } });
  await page.goto('/tim-tro');
  await expect(page.getByRole('heading', { name: 'Chưa tải được danh sách' })).toBeVisible();
  await expect(page.locator('a[href^="/tin/"]')).toHaveCount(0);
  await screenshot(page, 'api-error');
  await request.post(`${api}/_test/state`, { data: { mode: 'ok' } });
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.locator('a[href^="/tin/"]')).toHaveCount(20);
  await request.post(`${api}/_test/state`, { data: { mode: 'timeout' } });
  await page.goto('/tim-tro?trang=2', { waitUntil: 'commit' });
  await expect(page.getByLabel('Đang tải danh sách tin')).toBeVisible();
  await screenshot(page, 'listings-loading');
  await expect(page.getByText('API phản hồi quá lâu. Vui lòng thử lại.', { exact: true })).toBeVisible();
  await screenshot(page, 'api-timeout');
  await request.post(`${api}/_test/state`, { data: { mode: 'fail' } });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Đọc đúng/, level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chưa tải được số liệu kho' })).toBeVisible();
  await screenshot(page, 'home-stats-error');
});

test('comparison 503/404 stays local; retry reloads comparison', async ({ page, request }) => {
  const { edges } = await (await request.get(`${api}/_test/state`)).json();
  for (const mode of ['comparison_error', 'comparison_404']) {
    await request.post(`${api}/_test/state`, { data: { mode } });
    await page.goto(`/tin/${edges.emoji}?demo=true`);
    await expect(page.getByRole('heading', { name: 'Bằng chứng', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chưa tải được so sánh' })).toBeVisible();
  }
  await screenshot(page, 'comparison-error');
  await request.post(`${api}/_test/state`, { data: { mode: 'ok' } });
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chưa tải được so sánh' })).toHaveCount(0);
});

test('runtime DB changes are visible after refresh', async ({ page, request }) => {
  const before = await (await request.get(`${api}/api/v1/listings`)).json();
  await page.goto('/tim-tro');
  const added = await (await request.post(`${api}/_test/add`)).json();
  await page.reload();
  await expect(page.locator(`a[href="/tin/${added.id}?demo=true"]`)).toBeVisible();
  const after = await (await request.get(`${api}/api/v1/listings`)).json();
  expect(after.total).toBe(before.total + 1);
  await expect(page.getByText(`${after.total} tin phù hợp`, { exact: true })).toBeVisible();
});

test('desktop/mobile layout, filters and keyboard focus', async ({ page, request }) => {
  const { edges } = await (await request.get(`${api}/_test/state`)).json();
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, url] of [
      ['home', '/'],
      ['listings', '/tim-tro'],
      ['detail', `/tin/${edges.emoji}?demo=true`],
    ]) {
      await page.goto(url);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${name} width=${width}`,
      ).toBeTruthy();
      if (name === 'listings' && width < 768) {
        await page.getByRole('button', { name: /Bộ lọc/ }).click();
        await expect(page.getByRole('button', { name: 'Cầu Giấy', exact: true })).toBeVisible();
      }
      await screenshot(page, `${name}-${width}`);
    }
  }
});

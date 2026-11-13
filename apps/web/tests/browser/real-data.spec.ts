import { test, expect } from '@playwright/test';

// Opt in against the isolated SQLite server, never against production.
test.skip(!process.env.REAL_DATA_BASE_URL, 'Requires the local real-data SQLite scenario');
const base = process.env.REAL_DATA_BASE_URL || 'http://127.0.0.1:3004';
const api = process.env.REAL_DATA_API_URL || 'http://127.0.0.1:18024/api/v1';

test('public pages follow the server dataset and keep small samples honest', async ({ page, request }) => {
  expect(new URL(base).hostname).toBe('127.0.0.1');
  const listings = await (await request.get(api + '/listings')).json();
  const stats = await (await request.get(api + '/stats/overview')).json();
  expect(listings.is_demo).toBe(false);
  await page.goto(base + '/');
  await expect(page.locator('#stat-total')).toHaveText(stats.total_listings.toLocaleString('vi-VN'));
  await expect(page.locator('#stat-eligible')).toHaveText(stats.eligible_listings.toLocaleString('vi-VN'));
  await expect(page.getByText('Số liệu demo', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Bộ demo', exact: true })).toHaveCount(0);
  await expect(page.getByText(/Chưa đủ tin để tính/).first()).toBeVisible();
  await page.goto(base + '/tim-tro?demo=true');
  await expect(page.locator('main').getByText('Kho dữ liệu thật', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem bộ demo' })).toHaveCount(0);
  const links = await page.locator('a[href^="/tin/"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')!));
  expect(links).toHaveLength(listings.total);
  expect(links.every(link => link.includes('demo=false'))).toBe(true);
  if (!listings.total) {
    await expect(page.getByRole('heading', { name: 'Kho chưa có tin' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 960 });
    await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();
    await expect(page.getByRole('dialog').getByText('Chưa tải được phường hoặc kho chưa có tin.')).toBeVisible();
    await page.getByRole('button', { name: 'Đóng bộ lọc' }).click();
  } else {
    await expect(page.getByText('Chưa có ảnh hiển thị', { exact: true })).toHaveCount(listings.total);
    await page.goto(base + links[0]);
    await expect(page.getByText('Tin chưa có ảnh hiển thị', { exact: true })).toBeVisible();
    await expect(page.getByText('Ảnh phòng (ví dụ)', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Chưa đủ dữ liệu để nhận định:/)).toBeVisible();
    await expect(page.getByText('Trung bình nhóm', { exact: true })).toHaveCount(0);
    for (const href of await page.locator('a[href^="/tin/"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')!))) {
      expect((await request.get(base + href)).status()).toBe(200);
    }
  }
  await page.goto(base + '/tin/missing-real-listing');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy tin' })).toBeVisible();
  await page.goto(base + '/thi-truong?demo=true');
  await expect(page.locator('#market-demo')).toHaveValue('false');
  await expect(page.locator('#market-demo option[value="true"]')).toHaveCount(0);
  if (!listings.total) await expect(page.getByRole('heading', { name: 'Chưa có nhóm giá cho lựa chọn này.' })).toBeVisible();
  else {
    await expect(page.getByText(/Chưa đủ dữ liệu/).first()).toBeVisible();
    await expect(page.locator('[data-ready="true"]')).toHaveCount(0);
    const ward = page.getByText('Tăng Nhơn Phú', { exact: true }).first();
    await expect(ward).toBeVisible();
    expect(await ward.evaluate(el => new Set([...el.getClientRects()].map(rect => Math.round(rect.top))).size)).toBe(1);
  }
  await page.goto(base + '/extension');
  await expect(page.getByRole('heading', { name: 'Cách cài' })).toBeVisible();
  expect((await request.get(base + '/downloads/trocheck-collector.zip')).status()).toBe(200);
});

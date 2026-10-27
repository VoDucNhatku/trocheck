import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const origin = process.env.INTERIOR_WEB ?? 'http://127.0.0.1:3017';
const shots = path.resolve('../../.tmp/shell-shots');
const labels = ['Phân tích bài đăng', 'Tìm trọ', 'Thị trường', 'Kho dữ liệu', 'Hàng duyệt', 'Kiểm tra trích xuất', 'Đánh giá', 'Tài khoản'];
async function session(page: Page, username: string) {
  const { password } = JSON.parse(await readFile(path.resolve('../../.tmp/interior-test-credentials.json'), 'utf8'));
  const response = await page.request.post('/api/workspace/auth/login', {
    headers: { Origin: origin, 'X-ReNER-Request': '1' }, data: { username, password },
  });
  expect(response.status()).toBe(200);
  await page.goto('/phan-tich');
  await expect(page.getByRole('heading', { name: 'Đọc kỹ một bài đăng' })).toBeVisible();
}
test.beforeAll(async () => { await mkdir(shots, { recursive: true }); });

for (const [role, visible] of [
  ['renter', [0, 1, 2, 7]], ['collector', [0, 1, 2, 3, 7]],
  ['reviewer', [0, 1, 2, 3, 4, 7]], ['researcher', [0, 1, 2, 5, 6, 7]],
  ['admin', [0, 1, 2, 3, 4, 5, 6, 7]],
] as const) {
  test('shell navigation and responsive layout: ' + role, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await session(page, role);
    const sidebar = page.getByRole('complementary', { name: 'Điều hướng khu trong' });
    for (let index = 0; index < labels.length; index++) {
      await expect(sidebar.getByRole('link', { name: labels[index], exact: true })).toHaveCount((visible as readonly number[]).includes(index) ? 1 : 0);
    }
    await expect(sidebar.getByRole('link', { name: labels[0], exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(sidebar.getByText('Khu nhóm', { exact: true })).toHaveCount(role === 'renter' ? 0 : 1);
    for (const absent of ['Nguồn cào', 'Người dùng', 'Thông báo']) await expect(sidebar.getByRole('link', { name: absent, exact: true })).toHaveCount(0);
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width >= 768) {
        await expect(sidebar).toBeVisible();
        expect(Math.round((await sidebar.boundingBox())!.width)).toBe(width < 1024 ? 64 : 240);
        if (width === 768) {
          const link = sidebar.getByRole('link', { name: labels[0], exact: true });
          await link.focus();
          await expect(link.getByRole('tooltip')).toBeVisible();
          await expect(link).toHaveAttribute('aria-label', labels[0]);
          await page.getByRole('heading', { name: 'Đọc kỹ một bài đăng' }).click();
        }
      } else { await expect(sidebar).not.toBeVisible(); await expect(page.getByRole('button', { name: 'Mở điều hướng' })).toBeVisible(); }
      if (['renter', 'reviewer', 'admin'].includes(role)) await page.screenshot({ path: path.join(shots, `${role}-${width}.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test('account disclosure supports pointer, keyboard, focus return and real links', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await session(page, 'admin');
  const trigger = page.getByRole('button', { name: 'Menu tài khoản' });
  const popover = page.locator('#account-popover');
  await trigger.click(); await expect(popover).toBeVisible();
  await expect(popover).toContainText('admin'); await expect(popover).toContainText('Quản trị');
  await page.screenshot({ path: path.join(shots, 'account-open-1440.png'), fullPage: true, animations: 'disabled' });
  await trigger.click(); await expect(popover).toHaveCount(0);
  await trigger.focus(); await page.keyboard.press('Enter');
  await expect(popover.getByRole('link', { name: 'Tài khoản', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(popover).toHaveCount(0); await expect(trigger).toBeFocused();
  await page.keyboard.press('Space'); await expect(popover).toBeVisible();
  await page.getByRole('heading', { name: 'Đọc kỹ một bài đăng' }).click(); await expect(popover).toHaveCount(0);
  await trigger.click(); await popover.getByRole('link', { name: 'Tài khoản', exact: true }).click();
  await expect(page).toHaveURL(/\/tai-khoan$/); await expect(popover).toHaveCount(0);
  await trigger.click(); await popover.getByRole('link', { name: 'Về trang chủ', exact: true }).click();
  await expect(page).toHaveURL(origin + '/');
});

test('mobile drawer traps focus and closes on Escape, overlay, navigation and resize', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await session(page, 'admin');
  const trigger = page.getByRole('button', { name: 'Mở điều hướng' });
  const drawer = page.getByRole('dialog', { name: 'Điều hướng' });
  await trigger.click(); await expect(drawer).toBeVisible();
  await page.screenshot({ path: path.join(shots, 'drawer-open-390.png'), animations: 'disabled' });
  for (let index = 0; index < 16; index++) {
    await page.keyboard.press('Tab');
    expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  for (let index = 0; index < 16; index++) {
    await page.keyboard.press('Shift+Tab');
    expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape'); await expect(drawer).not.toBeVisible(); await expect(trigger).toBeFocused();
  await trigger.click(); await page.mouse.click(380, 420); await expect(drawer).not.toBeVisible(); await expect(trigger).toBeFocused();
  await trigger.click(); await drawer.getByRole('link', { name: 'Tài khoản', exact: true }).click();
  await expect(page).toHaveURL(/\/tai-khoan$/); await expect(drawer).not.toBeVisible();
  await trigger.click(); await page.setViewportSize({ width: 768, height: 1000 }); await expect(drawer).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('homepage login to workspace and back uses visible links', async ({ page }) => {
  await page.goto('/'); await page.getByRole('link', { name: 'Đăng nhập', exact: true }).first().click();
  const { password } = JSON.parse(await readFile(path.resolve('../../.tmp/interior-test-credentials.json'), 'utf8'));
  await page.getByLabel('Tên tài khoản', { exact: true }).fill('renter');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Vào bàn làm việc', exact: true }).click();
  await expect(page).toHaveURL(/\/phan-tich$/);
  await page.getByRole('complementary', { name: 'Điều hướng khu trong' }).getByRole('link', { name: 'Về trang chủ', exact: true }).click();
  await expect(page).toHaveURL(origin + '/');
  await page.getByRole('link', { name: 'Vào bàn làm việc', exact: true }).first().click();
  await expect(page.getByRole('complementary', { name: 'Điều hướng khu trong' })).toBeVisible();
});

test('shell colors meet contrast and reduced motion disables shell animation', async ({ page }) => {
  await session(page, 'admin');
  const pairs = await page.locator('[data-workspace-chrome]').first().evaluate(element => {
    const style = getComputedStyle(element);
    return [['--on-night', '--night'], ['--on-night-2', '--night'], ['--on-night', '--night-2'], ['--ink', '--paper'], ['--ink-3', '--surface'], ['--ink', '--hl']].map(pair => pair.map(key => style.getPropertyValue(key).trim()));
  });
  const lum = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const contrast = pairs.map(([a, b]) => ({ colors: [a, b], ratio: (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05) }));
  for (const value of contrast) expect(value.ratio).toBeGreaterThanOrEqual(4.5);
  await writeFile(path.join(shots, 'shell-contrast.json'), JSON.stringify(contrast, null, 2));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Menu tài khoản' }).click();
  await expect(page.locator('#account-popover')).toHaveCSS('animation-name', 'none');
  await page.keyboard.press('Escape'); await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Mở điều hướng' }).click();
  await expect(page.getByRole('dialog', { name: 'Điều hướng' })).toHaveCSS('animation-name', 'none');
});

import { expect, test } from '@playwright/test';

test('Google is enabled on login; registration still requires terms', async ({ page }) => {
  await page.goto('/dang-nhap');
  await expect(page.getByRole('button', { name: 'Tiếp tục với Google' })).toBeEnabled();
  await page.screenshot({ path: '../../.tmp/google-login-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../../.tmp/google-login-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: /Chuyển sang chế độ/ }).click();
  await page.screenshot({ path: '../../.tmp/google-login-mobile-dark.png', fullPage: true });
  await page.goto('/dang-ky');
  await page.getByRole('button', { name: 'Tiếp tục với Google' }).click();
  await expect(page.getByText('Bạn cần đồng ý điều khoản trước khi tạo tài khoản.')).toBeVisible();
  await expect(page).toHaveURL(/dang-ky/);
});

test('start redirects only to Google and keeps verifier in an HttpOnly cookie', async ({ page }) => {
  const response = await page.request.get('/api/auth/google/start?next=/tai-khoan', { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  const url = new URL(response.headers().location);
  expect(url.origin).toBe('https://accounts.google.com');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:3013/api/auth/google/callback');
  expect(response.headers()['cache-control']).toContain('no-store');
  const cookie = (await page.context().cookies()).find(value => value.name === 'rener_google_oauth');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  expect(cookie?.path).toBe('/api/auth/google');
  expect(response.headers().location).not.toContain('synthetic-google-secret');
});

test('forged callback and provider cancellation return a useful error', async ({ page }) => {
  await page.goto('/api/auth/google/callback?code=synthetic-code&state=forged');
  await expect(page).toHaveURL(/dang-nhap\?oauth_error=google_state_invalid/);
  await expect(page.getByRole('alert').filter({ hasText: 'hết hạn hoặc không hợp lệ' })).toBeVisible();
  await page.goto('/api/auth/google/callback?error=access_denied&error_description=untrusted-text');
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa hoàn tất đăng nhập Google' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('untrusted-text');
  await page.goto('/dang-nhap?oauth_error=__proto__');
  await expect(page.getByRole('heading', { name: 'Đăng nhập TrọCheck' })).toBeVisible();
});

test('successful callback creates a real renter session and preserves return path', async ({ page }) => {
  const start = await page.request.get('/api/auth/google/start?next=/tai-khoan', { maxRedirects: 0 });
  const state = new URL(start.headers().location).searchParams.get('state');
  await page.goto('/api/auth/google/callback?code=synthetic-code&state=' + state);
  await expect(page).toHaveURL(/\/tai-khoan$/);
  const me = await page.request.get('/api/workspace/auth/me');
  expect(me.status()).toBe(200);
  expect((await me.json()).roles).toEqual(['renter']);
  const cookies = await page.context().cookies();
  expect(cookies.find(cookie => cookie.name === 'rener_session')?.httpOnly).toBe(true);
  expect(cookies.some(cookie => cookie.name === 'rener_google_oauth')).toBe(false);
  const logout = await page.request.post('/api/workspace/auth/logout', {
    headers: { Origin: 'http://127.0.0.1:3013', 'X-ReNER-Request': '1' }, data: {},
  });
  expect(logout.status()).toBe(200);
  expect((await page.request.get('/api/workspace/auth/me')).status()).toBe(401);
});

test('return URL cannot redirect outside the app or create a session without the browser cookie', async ({ page, browser }) => {
  const start = await page.request.get('/api/auth/google/start?next=' + encodeURIComponent('//evil.example'), { maxRedirects: 0 });
  const state = new URL(start.headers().location).searchParams.get('state');
  const stranger = await browser.newContext();
  const forged = await stranger.request.get('http://127.0.0.1:3013/api/auth/google/callback?code=synthetic-code&state=' + state, { maxRedirects: 0 });
  expect(forged.headers().location).toContain('google_state_invalid');
  expect((await stranger.cookies()).some(cookie => cookie.name === 'rener_session')).toBe(false);
  await stranger.close();
  const response = await page.request.get('/api/auth/google/callback?code=synthetic-code&state=' + state, { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe('/phan-tich');
});

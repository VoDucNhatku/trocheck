import { test, expect } from '@playwright/test';
import path from 'node:path';

test('housing scroll reverses cleanly, loads its image, and preserves the selected dataset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?demo=false');
    await page.evaluate(() => document.fonts.ready);
    const photo = page.locator('[data-scene-photo]');
    await photo.locator('img').evaluate((image: HTMLImageElement) => image.decode());
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const initial = await photo.evaluate(e => getComputedStyle(e).transform);
    await page.evaluate(() => scrollTo(0, 650));
    await expect.poll(() => photo.evaluate(e => getComputedStyle(e).transform)).not.toBe(initial);
    await page.waitForTimeout(750);
    await page.screenshot({ path: path.resolve(`../../.tmp/b1-ui-evidence/housing-scroll-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.evaluate(() => scrollTo(0, 0));
    await expect.poll(() => photo.evaluate(e => getComputedStyle(e).transform)).toBe(initial);
    await page.getByRole('link', { name: 'Khám phá ReNER', exact: true }).click();
    await expect(page).toHaveURL(/demo=false#doc-bai-dang/);
    const reading = await page.locator('#reading-title').boundingBox();
    expect(reading!.y).toBeGreaterThan(56);
    expect(reading!.y).toBeLessThan(500);
    await page.evaluate(() => scrollTo(0, 0));
    await page.getByRole('link', { name: 'Tìm phòng của bạn', exact: true }).click();
    await expect(page).toHaveURL(/\/tim-tro\?demo=false/);
    await expect(page.getByRole('heading', { name: 'Kho chưa có tin' })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('housing reduced motion removes the pinned scene and keeps the content and controls usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?demo=true');
  const photo = page.locator('[data-scene-photo]');
  await photo.locator('img').evaluate((image: HTMLImageElement) => image.decode());
  expect(await photo.evaluate(e => getComputedStyle(e).transform)).toBe('none');
  await expect(page.locator('[data-scene-clouds]')).toBeHidden();
  expect(await photo.evaluate(e => getComputedStyle(e.parentElement!).position)).toBe('absolute');
  await page.getByRole('link', { name: 'Khám phá ReNER', exact: true }).click();
  await expect(page.locator('#reading-title')).toBeVisible();
  expect(await photo.evaluate(e => getComputedStyle(e).transform)).toBe('none');
  // Changing the OS preference while this route is open must also clean up motion.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => photo.evaluate(e => getComputedStyle(e).transform)).not.toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => photo.evaluate(e => getComputedStyle(e).transform)).toBe('none');
});

test('clouds enter after the last copy, cover the scene, and reverse on desktop and mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?demo=true');
    await page.evaluate(() => document.fonts.ready);
    const clouds = page.locator('[data-scene-clouds]');
    await clouds.locator('img').evaluateAll(async images => { await Promise.all(images.map(image => (image as HTMLImageElement).decode())); });
    await expect.poll(() => page.locator('[data-housing-scene]').evaluate(e => (e as HTMLElement).offsetHeight)).toBeGreaterThan(1800);
    const points = await page.locator('[data-scene-last-copy]').evaluate(copy => {
      const viewport = document.querySelector('[data-scene-photo]')!.parentElement!;
      const header = parseFloat(getComputedStyle(viewport).top);
      const start = copy.getBoundingClientRect().bottom + scrollY - header;
      return { start, travel: viewport.offsetHeight * .75 };
    });
    await expect(clouds).toHaveCSS('opacity', '0');
    await page.evaluate(y => scrollTo(0, y), points.start - 4);
    await expect(clouds).toHaveCSS('opacity', '0');
    await page.evaluate(y => scrollTo(0, y), points.start + points.travel * .5);
    await expect.poll(() => clouds.evaluate(e => Number(getComputedStyle(e).opacity))).toBeGreaterThan(.99);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.resolve(`../../.tmp/b1-ui-evidence/clouds-middle-${width}.png`) });
    await page.evaluate(y => scrollTo(0, y), points.start + points.travel + 2);
    await expect.poll(() => page.locator('[data-cloud-veil]').evaluate(e => Number(getComputedStyle(e).opacity))).toBeGreaterThan(.999);
    await page.screenshot({ path: path.resolve(`../../.tmp/b1-ui-evidence/clouds-full-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.evaluate(y => scrollTo(0, y), points.start + points.travel + 370);
    await expect(page.locator('#reading-title')).toBeInViewport();
    await page.evaluate(() => scrollTo(0, 0));
    await expect(clouds).toHaveCSS('opacity', '0');
    await expect(page.getByRole('link', { name: 'Tìm phòng của bạn', exact: true })).toBeInViewport();
  }
  expect(errors).toEqual([]);
});

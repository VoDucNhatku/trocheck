import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const api = process.env.PUBLIC_API ?? 'http://127.0.0.1:18000';
const evidence = path.resolve('../../.tmp/b1-ui-evidence');
test.beforeEach(async ({ request, page }) => {
  await request.post(`${api}/_test/state`, { data: { mode: 'ok' } });
  page.on('pageerror', (error) => {
    throw error;
  });
});
test.afterEach(async ({ request }) => {
  await request.post(`${api}/_test/state`, { data: { mode: 'ok' } });
});

test('detail API failure is explicit; comparison loading preserves already loaded evidence', async ({
  page,
  request,
}) => {
  const { edges } = await (await request.get(`${api}/_test/state`)).json();
  await request.post(`${api}/_test/state`, { data: { mode: 'fail' } });
  await page.goto(`/tin/${edges.emoji}?demo=true`);
  await expect(page.getByRole('heading', { name: 'Chưa tải được tin' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bằng chứng', exact: true })).toHaveCount(0);
  await page.screenshot({ path: path.join(evidence, 'detail-api-error.png'), fullPage: true });
  await request.post(`${api}/_test/state`, { data: { mode: 'comparison_slow' } });
  await page.goto(`/tin/${edges.emoji}?demo=true`, { waitUntil: 'commit' });
  await expect(page.getByRole('heading', { name: 'Bằng chứng', exact: true })).toBeVisible();
  await expect(page.getByText('Đang tải so sánh…')).toBeVisible();
  await page.screenshot({ path: path.join(evidence, 'comparison-loading.png'), fullPage: true });
  await expect(page.getByText('Đang tải so sánh…')).toHaveCount(0);
});

test('range inputs, price checkbox, sort, pagination, back and URL reload retain dataset and filters', async ({
  page,
}) => {
  await page.goto('/tim-tro?demo=true');
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Giá (triệu/tháng) từ' }).fill('2');
  await expect(page).toHaveURL(/gia_min=2/);
  await page.getByRole('spinbutton', { name: 'Giá (triệu/tháng) đến' }).fill('7');
  await expect(page).toHaveURL(/gia_max=7/);
  await page.getByRole('spinbutton', { name: 'Diện tích (m²) từ' }).fill('20');
  await expect(page).toHaveURL(/dt_min=20/);
  await page.getByRole('spinbutton', { name: 'Diện tích (m²) đến' }).fill('40');
  await expect(page).toHaveURL(/dt_max=40/);
  await page.getByRole('checkbox', { name: 'Chỉ tin có giá' }).check();
  await expect(page).toHaveURL(/co_gia=1/);
  await page.getByRole('combobox', { name: 'Sắp xếp' }).selectOption('price_asc');
  await expect(page).toHaveURL(/sap_xep=price_asc/);
  await page.getByRole('link', { name: 'Trang sau', exact: true }).click();
  await expect(page).toHaveURL(/trang=2/);
  const filteredURL = page.url();
  await page.locator('a[href^="/tin/"]').first().click();
  await expect(page.getByRole('heading', { name: 'Bằng chứng', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(filteredURL);
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Giá (triệu/tháng) từ' })).toHaveValue('2');
  await expect(page.getByRole('checkbox', { name: 'Chỉ tin có giá' })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Sắp xếp' })).toHaveValue('price_asc');
  await expect(page.getByRole('navigation', { name: 'Phân trang' })).toContainText('Trang 2/');
  await page.getByRole('button', { name: 'Xóa lọc', exact: true }).click();
  await expect(page).not.toHaveURL(/gia_min|gia_max|dt_min|dt_max|co_gia|trang=/);
  expect(new URL(page.url()).searchParams.get('demo')).toBe('true');
});

test('mobile menu, skip link and evidence support keyboard; reduced motion keeps all content visible', async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?demo=false');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Bỏ qua tới nội dung' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  const menu = page.getByRole('button', { name: 'Mở menu' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Điều hướng trên điện thoại' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  await page
    .getByRole('navigation', { name: 'Điều hướng trên điện thoại' })
    .getByRole('link', { name: 'Tìm trọ', exact: true })
    .click();
  await expect(page).toHaveURL(/demo=false/);
  await expect(page.getByRole('heading', { name: 'Kho chưa có tin' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Điều hướng trên điện thoại' })).toBeHidden();
  const { edges } = await (await request.get(`${api}/_test/state`)).json();
  await page.goto(`/tin/${edges.emoji}?demo=true`);
  const rent = page.getByRole('button', { name: /GIÁ Giá thuê/ });
  await rent.focus();
  await page.keyboard.press('Enter');
  const span = page.locator('button[data-label="PRICE"]').first();
  await expect(span).toHaveAttribute('aria-pressed', 'true');
  await expect(span).toContainText('5tr5');
  await span.focus();
  await page.keyboard.press('Enter');
  await expect(rent).toHaveAttribute('aria-pressed', 'false');
  const focus = await span.evaluate((e) => ({
    style: getComputedStyle(e).outlineStyle,
    width: getComputedStyle(e).outlineWidth,
  }));
  expect(focus).toEqual({ style: 'solid', width: '2px' });
  await page.screenshot({ path: path.join(evidence, 'keyboard-reduced-motion.png'), fullPage: true });
  const motions = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  expect(motions).toBe(0);
});

async function textContrast(page: Page) {
  return page.evaluate(() => {
    const rgba = (v: string) => (v.match(/[\d.]+/g) ?? []).map(Number);
    const blend = (fg: number[], bg: number[]) => {
      const alpha = fg[3] ?? 1;
      return [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha));
    };
    const luminance = (rgb: number[]) =>
      rgb
        .slice(0, 3)
        .map((n) => n / 255)
        .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
        .reduce((s, n, i) => s + n * [0.2126, 0.7152, 0.0722][i], 0);
    const failures: { text: string; ratio: number; color: string; background: number[] }[] = [];
    let checked = 0;
    let minimum = 30;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const el = node.parentElement!;
      if (el.closest('script,style,svg,.visually-hidden,[hidden]')) continue;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (!r.width || !r.height || style.visibility === 'hidden' || style.display === 'none') continue;
      const ancestry: Element[] = [];
      let parent: Element | null = el;
      while (parent) {
        ancestry.unshift(parent);
        parent = parent.parentElement;
      }
      let bg = [255, 255, 255];
      for (const ancestor of ancestry) bg = blend(rgba(getComputedStyle(ancestor).backgroundColor), bg);
      const fg = blend(rgba(style.color), bg);
      const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      const ratio = (l1 + 0.05) / (l2 + 0.05);
      const large =
        parseFloat(style.fontSize) >= 24 || (Number(style.fontWeight) >= 700 && parseFloat(style.fontSize) >= 18.666);
      checked++;
      minimum = Math.min(minimum, ratio);
      if (ratio < (large ? 3 : 4.5))
        failures.push({ text: node.textContent.trim().slice(0, 70), ratio, color: style.color, background: bg });
    }
    return { checked, minimum, failures };
  });
}

test('Stitch layouts have no overlaps, clipped text or horizontal overflow; visible text passes AA contrast', async ({
  page,
  request,
}) => {
  const { edges } = await (await request.get(`${api}/_test/state`)).json();
  const report: unknown[] = [];
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, url] of [
      ['home', '/?demo=true'],
      ['listings', '/tim-tro?demo=true&sap_xep=price_asc'],
      ['detail', `/tin/${edges.emoji}?demo=true`],
    ]) {
      await page.goto(url);
      if (name === 'home') await page.getByRole('region', { name: 'Số liệu kho' }).waitFor();
      if (name === 'listings') {
        await expect(page.locator('a[href^="/tin/"]')).toHaveCount(20);
        await expect(page.locator('a[href^="/tin/"]').first()).toBeVisible();
      }
      if (name === 'detail') {
        await expect(page.getByRole('heading', { name: 'Bằng chứng', exact: true })).toBeVisible();
        await expect(page.getByText('Đang tải so sánh…')).toHaveCount(0);
      }
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${name} ${width}`,
      ).toBeTruthy();
      const clipped = await page.locator('h1,h2,h3,button,input,select').evaluateAll((els) =>
        els
          .filter((e) => {
            const s = getComputedStyle(e);
            return e.getBoundingClientRect().width && s.overflowX === 'hidden' && e.scrollWidth > e.clientWidth + 1;
          })
          .map((e) => e.textContent),
      );
      expect(clipped, `${name} ${width} clipped`).toEqual([]);
      await expect(page.locator('a[href="#"]')).toHaveCount(0);
      if (name === 'listings') {
        const boxes = await page.locator('a[href^="/tin/"]').evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect();
            return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
          }),
        );
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i],
              b = boxes[j];
            expect(
              a.right <= b.x + 1 || b.right <= a.x + 1 || a.bottom <= b.y + 1 || b.bottom <= a.y + 1,
              `cards ${i}/${j} at ${width}`,
            ).toBeTruthy();
          }
      }
      const contrast = await textContrast(page);
      expect(contrast.checked, `${name} ${width} text nodes`).toBeGreaterThan(30);
      expect(contrast.failures, `${name} ${width} contrast`).toEqual([]);
      report.push({ name, width, ...contrast });
      await page.screenshot({ path: path.join(evidence, `stitch-${name}-${width}.png`), fullPage: true });
      await page.screenshot({ path: path.join(evidence, `stitch-${name}-${width}-viewport.png`) });
    }
  }
  await import('node:fs/promises').then((fs) =>
    fs.writeFile(path.join(evidence, 'contrast-and-layout.json'), JSON.stringify(report, null, 2)),
  );
  await test
    .info()
    .attach('contrast-and-layout.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
});

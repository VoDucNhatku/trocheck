// Rendered-page regression gate. The prototype's gate and lessons are read-only references.
// Run: node scripts/qa-gate.mjs --base http://127.0.0.1:3100 --pages /,/tim-tro
// Optional: --shots <directory> --storage-state <Playwright state file>.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RULES = {
  R01: 'Đơn vị /phòng ngoài trích dẫn', R02: 'Tên cũ hoặc thống kê cũ',
  R04: 'Chữ dưới 12px', R06: 'Số tách khỏi đơn vị', R07: 'Tràn ngang',
  R08: 'Chữ đè nhau', R10: 'Tương phản', R11: 'Ảnh và logo',
  R13: 'Lỗi JavaScript/console', R18: 'Cụm ngắn bị bẻ dòng',
  R19: 'Dấu chấm thập phân', R30: 'Còn màu xanh ngọc',
};

export function parseOptions(args) {
  const options = { base: 'http://127.0.0.1:3100', pages: '/,/tim-tro', themes: 'light,dark', widths: '1440,390,320', label: 'qa-' + new Date().toISOString().replace(/[:.]/g, '-'), shots: undefined, 'storage-state': undefined };
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index].replace(/^--/, '');
    if (!args[index].startsWith('--') || !Object.hasOwn(options, name)) throw new Error('Unknown option: ' + args[index]);
    if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Missing value: ' + args[index]);
    options[name] = args[index + 1];
  }
  const base = new URL(options.base);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Invalid --base');
  if (!/^[a-z\d][a-z\d._-]{0,100}$/i.test(options.label)) throw new Error('Invalid --label: use a safe filename');
  const pages = [...new Set(options.pages.split(','))];
  if (!pages.length || pages.some(page => !page.startsWith('/') || page.startsWith('//') || new URL(page, base).origin !== base.origin)) throw new Error('Invalid --pages: use same-origin paths');
  const themes = [...new Set(options.themes.split(','))];
  if (themes.some(theme => !['light', 'dark'].includes(theme))) throw new Error('Invalid --themes');
  const widths = [...new Set(options.widths.split(',').map(Number))];
  if (widths.some(width => !Number.isInteger(width) || width < 100 || width > 3840)) throw new Error('Invalid --widths');
  return { base: base.href, pages, themes, widths, label: options.label, shots: options.shots && path.resolve(options.shots), storageState: options['storage-state'] && path.resolve(options['storage-state']) };
}

// Self-contained: this function is serialized into Chromium by page.evaluate.
export function auditPage({ expectTheme } = {}) {
  const issues = [], keys = new Set();
  const sample = text => String(text).replace(/\s+/g, ' ').trim().slice(0, 180);
  const selector = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : [...el.classList].slice(0, 2).map(name => '.' + name).join(''));
  const add = (rule, level, detail, text, el) => {
    const issue = { rule, level, detail, ...(text ? { sample: sample(text) } : {}), ...(el ? { selector: selector(el) } : {}) };
    const key = JSON.stringify(issue); if (!keys.has(key)) { keys.add(key); issues.push(issue); }
  };
  const rect = b => ({ left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.right - b.left, height: b.bottom - b.top });
  const intersect = (a, b, x = true, y = true) => rect({ left: x ? Math.max(a.left, b.left) : a.left, right: x ? Math.min(a.right, b.right) : a.right, top: y ? Math.max(a.top, b.top) : a.top, bottom: y ? Math.min(a.bottom, b.bottom) : a.bottom });
  const styles = new Map();
  const style = el => { if (!styles.has(el)) styles.set(el, getComputedStyle(el)); return styles.get(el); };
  const visible = el => {
    if (!el.getClientRects().length || (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))) return false;
    for (let node = el; node; node = node.parentElement) {
      const s = style(node);
      if (s.display === 'none' || s.visibility !== 'visible' || Number(s.opacity) === 0 || s.clipPath === 'inset(50%)' || (s.clip !== 'auto' && /rect\(0px[, ]+0px[, ]+0px[, ]+0px\)/.test(s.clip))) return false;
    }
    return true;
  };
  const clipped = (b, el) => {
    let result = rect(b);
    for (let node = el; node; node = node.parentElement) {
      const s = style(node), box = node.getBoundingClientRect();
      const clipX = /^(hidden|clip|scroll|auto)$/.test(s.overflowX), clipY = /^(hidden|clip|scroll|auto)$/.test(s.overflowY);
      if (clipX || clipY) {
        const paddingBox = { left: box.left + node.clientLeft, top: box.top + node.clientTop, right: box.left + node.clientLeft + node.clientWidth, bottom: box.top + node.clientTop + node.clientHeight };
        result = intersect(result, paddingBox, clipX, clipY);
      }
    }
    return result;
  };
  const textRects = (node, start = 0, end = node.length) => {
    const range = document.createRange(); range.setStart(node, start); range.setEnd(node, end);
    return [...range.getClientRects()].map(b => clipped(b, node.parentElement)).filter(b => b.width > 0.5 && b.height > 0.5);
  };
  const inQuote = el => !!el.closest('[data-quote], [data-evidence], blockquote, pre, code, .evidence, .post-text, [class*="excerpt"], [class*="postText"], [class*="EvidenceHighlighter_text__"], [class*="_evidence__"]');
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const nodes = [], groups = new Map();
  const owner = el => {
    const semantic = el.closest('p, a, button, label, summary, h1, h2, h3, h4, dt, dd, td, th, li');
    if (semantic) return semantic;
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      if (['A', 'BUTTON', 'LABEL', 'SUMMARY'].includes(node.tagName) || !['inline', 'contents'].includes(style(node).display)) return node;
    }
    return document.body;
  };
  let lastGroup;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'BR' && lastGroup && visible(node)) lastGroup.text += '\n';
      continue;
    }
    const el = node.parentElement;
    if (!el || !node.textContent.length || el.closest('script, style, noscript, template, next-route-announcer') || !visible(el)) continue;
    const boxes = textRects(node); if (!boxes.length) continue;
    if (node.textContent.trim()) nodes.push({ node, el, boxes });
    const parent = owner(el), quote = inQuote(el);
    // Separate quote text from authored text even when nested in the same block.
    if (!groups.has(parent)) groups.set(parent, []);
    const list = groups.get(parent);
    let group = list.at(-1);
    if (!group || group !== lastGroup || group.quote !== quote) { group = { el: parent, quote, text: '', parts: [] }; list.push(group); }
    group.parts.push({ node, start: group.text.length, end: group.text.length + node.length });
    group.text += node.textContent;
    lastGroup = group;
  }
  const rangeRects = (group, start = 0, end = group.text.length) => group.parts.flatMap(part => {
    const a = Math.max(start, part.start), b = Math.min(end, part.end);
    return a < b ? textRects(part.node, a - part.start, b - part.start) : [];
  });
  // A small unit beside a large number can have a different top on the SAME line.
  const lineCount = boxes => {
    const lines = [];
    for (const box of [...boxes].sort((a, b) => a.top - b.top)) {
      const line = lines.find(item => Math.min(item.bottom, box.bottom) - Math.max(item.top, box.top) > 1);
      if (line) { line.top = Math.max(line.top, box.top); line.bottom = Math.min(line.bottom, box.bottom); }
      else lines.push({ top: box.top, bottom: box.bottom });
    }
    return lines.length;
  };
  const allGroups = [...groups.values()].flat();
  for (const group of allGroups) {
    if (group.quote) continue;
    const text = group.text;
    if (/\/\s*phòng\b/iu.test(text)) add('R01', 'FAIL', 'Đơn vị tự viết phải là /tháng', text, group.el);
    if (/\bP25\b|\bP75\b|trung\s+vị|ReNER/iu.test(text)) add('R02', 'FAIL', 'Còn tên/thống kê cũ trên giao diện', text, group.el);
    for (const match of text.matchAll(/(?<![\p{L}\d])\d+(?:[.,]\d+)+/gu)) {
      const number = match[0];
      const thousands = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(number);
      const date = /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(number);
      if (number.includes('.') && !thousands && !date) add('R19', 'FAIL', 'Số thập phân cần dấu phẩy', number + ' — ' + text, group.el);
    }
    for (const match of text.matchAll(/\d[\d.,]*\s*(?:triệu|tr|m²|m2|đ|%|người|tháng|k)(?![\p{L}\d])/giu)) {
      if (lineCount(rangeRects(group, match.index, match.index + match[0].length)) > 1) add('R06', 'FAIL', 'Số bị tách khỏi đơn vị', match[0], group.el);
    }
    const phrases = new Set(['Cầu Giấy', 'thang máy', 'Trung bình', 'Không đề cập', 'Quay lại', 'Tiếp tục', 'Che thông tin', 'Diện tích', 'Loại phòng', 'Giá thuê']);
    // Whole prose nodes and short controls are phrases; a label + <br> + value is not.
    const candidates = group.parts.map(part => part.node.textContent.trim());
    if (group.el.matches('button,label,summary,[data-phrase]')) candidates.push(text.trim());
    for (const candidate of candidates) {
      const words = candidate.split(/\s+/);
      if (words.length >= 2 && words.length <= 3 && candidate.length <= 22 && /^\p{L}[\p{L}\p{M}\s-]*[.!?:]?$/u.test(candidate) && !candidate.includes('\n') && !group.el.closest('h1,h2')) phrases.add(candidate);
    }
    for (const phrase of phrases) {
      const pattern = phrase.split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
      for (const match of text.matchAll(new RegExp(pattern, 'giu'))) {
        if (lineCount(rangeRects(group, match.index, match.index + match[0].length)) > 1) add('R18', 'FAIL', 'Cụm ngắn bị bẻ dòng', match[0], group.el);
      }
    }
  }
  for (const { node, el } of nodes) {
    const size = parseFloat(style(el).fontSize);
    if (size < 12) add('R04', 'FAIL', 'Cỡ chữ ' + size + 'px < 12px', node.textContent, el);
  }
  const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (scrollWidth > innerWidth + 1) add('R07', 'FAIL', `scrollWidth ${scrollWidth}px > innerWidth ${innerWidth}px`);

  // Font em-boxes can overlap between healthy heading lines. Use measured glyph ink
  // vertically, keeping the original 3px/4px collision thresholds and all scroll clips.
  const inkContext = document.createElement('canvas').getContext('2d');
  const inkRects = entry => {
    const s = style(entry.el);
    inkContext.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const metrics = inkContext.measureText(entry.node.textContent);
    const range = document.createRange(); range.selectNodeContents(entry.node);
    return [...range.getClientRects()].map(box => {
      const scale = box.height / (metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent);
      const baseline = box.top + metrics.fontBoundingBoxAscent * scale;
      return clipped({ left: box.left, right: box.right, top: baseline - metrics.actualBoundingBoxAscent * scale, bottom: baseline + metrics.actualBoundingBoxDescent * scale }, entry.el);
    }).filter(box => box.width > .5 && box.height > .5);
  };
  // Sweep vertically. No arbitrary text-count cap or sticky exemption.
  const leaves = nodes.flatMap(entry => inkRects(entry).map(box => ({ ...entry, box }))).sort((a, b) => a.box.top - b.box.top);
  let active = [];
  for (const item of leaves) {
    active = active.filter(other => other.box.bottom > item.box.top + 4);
    for (const other of active) {
      const overlap = intersect(item.box, other.box);
      if (overlap.width > 3 && overlap.height > 4) add('R08', 'FAIL', `Hai chữ đè nhau (${overlap.width.toFixed(1)} × ${overlap.height.toFixed(1)}px)`, sample(other.node.textContent) + ' × ' + sample(item.node.textContent), item.el);
    }
    active.push(item);
  }

  // Canvas converts computed CSS colors (including color(srgb ...)) to sRGB.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const colors = new Map();
  const parseColor = value => {
    if (colors.has(value)) return colors.get(value);
    if (!CSS.supports('color', value)) return null;
    context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
    const bytes = context.getImageData(0, 0, 1, 1).data;
    const color = [bytes[0], bytes[1], bytes[2], bytes[3] / 255]; colors.set(value, color); return color;
  };
  const over = (top, under) => {
    const alpha = top[3] + under[3] * (1 - top[3]);
    return [0, 1, 2].map(i => alpha ? (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / alpha : 0).concat(alpha);
  };
  const luminance = color => color.slice(0, 3).map(channel => { const v = channel / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const elements = [...document.body.querySelectorAll('*')].filter(el => visible(el));
  const images = elements.filter(el => el.tagName === 'IMG' || style(el).backgroundImage !== 'none').map(el => ({ el, box: el.getBoundingClientRect() }));
  const contrastChecked = new Set(); let contrastMeasured = 0, contrastUnmeasured = 0;
  for (const { el, node, boxes } of nodes) {
    if (contrastChecked.has(el) || el.closest(':disabled, [aria-disabled="true"]')) continue;
    contrastChecked.add(el);
    let fg = parseColor(style(el).color), bg = [0, 0, 0, 0], unknown = false, opaqueLayer = null;
    if (!fg) { add('R10', 'WARN', 'Không đọc được màu chữ; cần kiểm tay', node.textContent, el); continue; }
    for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
      const s = style(ancestor), layer = parseColor(s.backgroundColor);
      if (bg[3] < .999 && s.backgroundImage !== 'none') unknown = true;
      if (layer) { fg = over(fg, layer); bg = over(bg, layer); if (!opaqueLayer && layer[3] === 1) opaqueLayer = ancestor; }
      fg[3] *= Number(s.opacity); bg[3] *= Number(s.opacity);
    }
    // A positioned photo/scrim can be a sibling, not a background on the text's ancestors.
    if (opaqueLayer && images.some(image => opaqueLayer.contains(image.el) && !el.contains(image.el) && boxes.some(box => { const hit = intersect(box, image.box); return hit.width > 1 && hit.height > 1; }))) unknown = true;
    if (unknown) { contrastUnmeasured++; add('R10', 'WARN', 'Chữ trên ảnh/gradient: cần đo nền thực tế bằng tay', node.textContent, el); continue; }
    bg = over(bg, [255, 255, 255, 1]); fg = over(fg, [255, 255, 255, 1]);
    const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a), ratio = (values[0] + .05) / (values[1] + .05);
    const s = style(el), fs = parseFloat(s.fontSize), large = fs >= 24 || (fs >= 18.666 && Number(s.fontWeight) >= 700), minimum = large ? 3 : 4.5;
    contrastMeasured++;
    if (ratio < minimum) add('R10', 'FAIL', `Tương phản ${ratio.toFixed(2)}:1 < ${minimum}:1`, node.textContent, el);
  }
  for (const image of document.images) {
    if (visible(image) && (!image.complete || !image.naturalWidth)) add('R11', 'FAIL', 'Ảnh không tải được', image.getAttribute('src'), image);
  }
  const approved = [...document.images].some(image => /\/brand\/trocheck-(icon|wordmark-(light|dark))\.png(?:\?|$)/.test(image.src) && image.complete && image.naturalWidth && visible(image) && clipped(image.getBoundingClientRect(), image).width > 0);
  if (!approved) {
    // Narrow workspace menus expose the approved logo inside a closed drawer.
    const drawerLogo = [...document.querySelectorAll('dialog img')].some(image => /\/brand\/trocheck-(icon|wordmark-(light|dark))\.png(?:\?|$)/.test(image.src) && image.complete && image.naturalWidth);
    const trigger = [...document.querySelectorAll('button[aria-controls]')].some(button => document.getElementById(button.getAttribute('aria-controls'))?.tagName === 'DIALOG' && visible(button));
    if (innerWidth < 768 && drawerLogo && trigger) add('R11', 'WARN', 'Logo chỉ nằm trong menu đóng; cần mở menu kiểm trực quan');
    else add('R11', 'FAIL', 'Không thấy logo TrọCheck đã tải và đang hiện');
  }
  const legacy = new Set(['0,82,67', '20,108,90', '135,213,191', '155,234,211', '163,242,219', '183,255,232', '0,67,53', '0,54,44', '220,239,232', '18,60,48', '16,31,26', '28,48,40', '41,70,56', '11,20,16', '20,45,35', '146,179,163', '16,25,22', '24,36,31', '32,47,40', '40,59,50', '9,24,18', '17,28,45']);
  const paintProperties = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'textDecorationColor', 'fill', 'stroke'];
  for (const el of elements) {
    // Detect retired teal paint, including entity highlights.
    for (const pseudo of [null, '::before', '::after']) {
      const s = pseudo ? getComputedStyle(el, pseudo) : style(el);
      if (pseudo && (s.content === 'none' || s.content === 'normal' || s.display === 'none')) continue;
      if (s.visibility !== 'visible' || Number(s.opacity) === 0) continue;
      const found = [];
      for (const prop of paintProperties) {
        if (prop.startsWith('border') && (parseFloat(s[prop.replace('Color', 'Width')]) === 0 || s[prop.replace('Color', 'Style')] === 'none')) continue;
        if (prop === 'outlineColor' && (s.outlineStyle === 'none' || parseFloat(s.outlineWidth) === 0)) continue;
        if (prop === 'textDecorationColor' && s.textDecorationLine === 'none') continue;
        const color = parseColor(s[prop]);
        if (color && color[3] > 0 && legacy.has(color.slice(0, 3).join(','))) found.push(prop);
      }
      for (const value of [s.backgroundImage, s.boxShadow, s.textShadow]) for (const match of value.matchAll(/rgba?\([^)]+\)/g)) {
        const color = parseColor(match[0]); if (color && color[3] > 0 && legacy.has(color.slice(0, 3).join(','))) found.push('gradient/shadow');
      }
      if (found.length) add('R30', 'FAIL', 'Còn màu xanh ngọc: ' + [...new Set(found)].join(', ') + (pseudo || ''), el.textContent, el);
    }
  }
  const actualTheme = document.documentElement.dataset.theme;
  if (expectTheme && actualTheme !== expectTheme) add('R12', 'FAIL', `data-theme=${actualTheme}; cần ${expectTheme}`);
  return { issues, metrics: { innerWidth, scrollWidth, textNodes: nodes.length, textRects: leaves.length, contrastMeasured, contrastUnmeasured, actualTheme, colorScheme: style(document.documentElement).colorScheme } };
}

const escapeCell = value => String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
export async function runGate(options) {
  const report = { label: options.label, at: new Date().toISOString(), base: options.base, pages: options.pages, widths: options.widths, themes: options.themes, authenticated: Boolean(options.storageState), rules: RULES, results: [], global: [] };
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    if (options.shots) await mkdir(options.shots, { recursive: true });
    for (const route of options.pages) for (const theme of options.themes) for (const width of options.widths) {
      const result = { page: route, theme, width, issues: [] };
      let context;
      try {
        context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', ...(options.storageState ? { storageState: options.storageState } : {}) });
        await context.addInitScript(mode => { document.documentElement?.setAttribute('data-theme', mode); addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-theme', mode), { once: true }); }, theme);
        const page = await context.newPage();
        page.on('pageerror', error => result.issues.push({ rule: 'R13', level: 'FAIL', detail: 'pageerror: ' + error.message.slice(0, 400) }));
        page.on('console', message => { if (message.type() === 'error') result.issues.push({ rule: 'R13', level: 'FAIL', detail: 'console: ' + message.text().slice(0, 400) }); });
        const url = new URL(route, options.base); url.searchParams.set('theme', theme);
        const response = await page.goto(url.href, { waitUntil: 'networkidle', timeout: 60000 });
        if (!response || response.status() >= 400) result.issues.push({ rule: 'R13', level: 'FAIL', detail: 'HTTP trang: ' + (response?.status() ?? 'không có response') });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => [...document.images].every(image => image.complete), undefined, { timeout: 10000 }).catch(() => {});
        await page.evaluate(mode => document.documentElement.setAttribute('data-theme', mode), theme);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const audit = await page.evaluate(auditPage, { expectTheme: theme });
        result.issues.push(...audit.issues); result.metrics = audit.metrics;
        result.url = page.url(); result.status = response?.status();
        if (new URL(page.url()).pathname !== url.pathname) result.issues.push({ rule: 'R00', level: 'WARN', detail: 'URL chuyển hướng; chưa kiểm nội dung route yêu cầu: ' + new URL(page.url()).pathname });
        if (options.shots) {
          const slug = url.pathname === '/' ? 'home' : url.pathname.replace(/[^a-z\d-]+/gi, '-').replace(/^-|-$/g, '');
          const hash = createHash('sha256').update(route).digest('hex').slice(0, 8);
          result.screenshot = path.join(options.shots, `${slug}-${hash}-${width}-${theme}.png`);
          await page.screenshot({ path: result.screenshot, fullPage: true, animations: 'disabled' });
        }
      } catch (error) { result.issues.push({ rule: 'R13', level: 'FAIL', detail: 'Không hoàn tất lượt kiểm: ' + error.message.slice(0, 500) }); }
      finally { await context?.close(); }
      result.issues = [...new Map(result.issues.map(issue => [JSON.stringify(issue), issue])).values()];
      report.results.push(result);
      console.log(`${route} ${theme} ${width}: FAIL ${result.issues.filter(issue => issue.level === 'FAIL').length} · WARN ${result.issues.filter(issue => issue.level === 'WARN').length}`);
    }
  } catch (error) { report.global.push({ rule: 'R13', level: 'FAIL', detail: 'Không khởi tạo được cổng kiểm: ' + error.message.slice(0, 500) }); }
  finally { await browser?.close(); }
  const issues = [...report.results.flatMap(result => result.issues), ...report.global];
  report.summary = { runs: report.results.length, expectedRuns: options.pages.length * options.themes.length * options.widths.length, fail: issues.filter(issue => issue.level === 'FAIL').length, warn: issues.filter(issue => issue.level === 'WARN').length, byRule: Object.fromEntries([...new Set([...Object.keys(RULES), ...issues.map(issue => issue.rule)])].map(rule => [rule, { fail: issues.filter(issue => issue.rule === rule && issue.level === 'FAIL').length, warn: issues.filter(issue => issue.rule === rule && issue.level === 'WARN').length }])) };
  if (report.summary.runs !== report.summary.expectedRuns && !report.global.length) { report.global.push({ rule: 'R13', level: 'FAIL', detail: 'Thiếu lượt kiểm' }); report.summary.fail++; }
  const output = path.join(WEB, 'qa-out'); await mkdir(output, { recursive: true });
  let md = `# Cổng kiểm ${options.label}\n\n${report.at}\n\n${options.pages.length} trang × ${options.themes.length} chế độ × ${options.widths.length} khổ = ${report.summary.runs}/${report.summary.expectedRuns} lượt. **FAIL: ${report.summary.fail} · WARN: ${report.summary.warn}**\n\nMỗi FAIL là một phát hiện ở một trang/chế độ/khổ; không phải số lỗi duy nhất sau gộp. Ảnh/gradient cần kiểm tay được ghi WARN, không tính là đã đo tương phản. Chỉ kiểm trạng thái sau tải trang; menu chưa mở và trạng thái tương tác chưa kích hoạt cần kiểm riêng.\n\n| Luật | Nội dung | FAIL | WARN |\n|---|---|---|---|\n`;
  for (const [rule, count] of Object.entries(report.summary.byRule)) md += `| ${rule} | ${RULES[rule] ?? 'Độ phủ/chế độ'} | ${count.fail} | ${count.warn} |\n`;
  md += '\n| Trang | Chế độ | Khổ | Mức | Luật | Chi tiết | Mẫu | Phần tử |\n|---|---|---|---|---|---|---|---|\n';
  for (const result of report.results) for (const issue of result.issues) md += `| ${[result.page, result.theme, result.width, issue.level, issue.rule, issue.detail, issue.sample, issue.selector].map(escapeCell).join(' | ')} |\n`;
  for (const issue of report.global) md += `| (toàn bộ) | | | ${issue.level} | ${issue.rule} | ${escapeCell(issue.detail)} | | |\n`;
  await writeFile(path.join(output, options.label + '.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  await writeFile(path.join(output, options.label + '.md'), md, 'utf8');
  console.log(`${options.label}: FAIL ${report.summary.fail} · WARN ${report.summary.warn} → qa-out/${options.label}.md`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const report = await runGate(parseOptions(process.argv.slice(2))); process.exitCode = report.summary.fail ? 1 : 0; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

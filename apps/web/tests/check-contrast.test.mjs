import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { checkContrast, contrastRatio } from '../scripts/check-contrast.mjs';

const fixture = `:root {
  --paper: light-dark(#ffffff, #000000);
  --ink: light-dark(#000000, #ffffff);
  --text: var(--ink);
}
/* @contrast text --text --paper 4.5 */`;

test('WCAG reference ratios retain precision at the AA boundary', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
  assert.ok(contrastRatio('#777777', '#ffffff') < 4.5);
  assert.ok(contrastRatio('#767676', '#ffffff') > 4.5);
});

test('resolves aliases and evaluates both light and dark branches', () => {
  const result = checkContrast(fixture);
  assert.deepEqual(result.map((row) => [row.mode, row.ratio, row.pass]), [
    ['light', 21, true], ['dark', 21, true],
  ]);
  const brokenDark = checkContrast(fixture.replace('#000000);', '#ffffff);'));
  assert.equal(brokenDark[0].pass, true);
  assert.equal(brokenDark[1].pass, false);
});

test('resolves explicit dark defaults and light overrides through aliases', () => {
  const result = checkContrast(`:root,[data-theme="dark"] { --night:#000000; --on-night:#ffffff; --text:var(--on-night); }
    [data-theme="light"] { --night:#ffffff; --on-night:#000000; }
    /* @contrast body --text --night 4.5 */`);
  assert.deepEqual(result.map(row => [row.mode, row.ratio, row.pass]), [['light', 21, true], ['dark', 21, true]]);
});

test('rejects missing, cyclic, or malformed contracts instead of silently passing', () => {
  assert.throws(() => checkContrast(fixture.replace('--text: var(--ink);', '--text: var(--ink); --text: #ffffff;')), /Ambiguous/);
  assert.throws(() => checkContrast(fixture.replace('var(--ink)', 'var(--missing)')), /Missing token/);
  assert.throws(() => checkContrast(fixture.replace('var(--ink)', 'var(--text)')), /Cyclic token/);
  assert.throws(() => checkContrast(fixture + '\n/* @contrast typo --text --paper 4.4 */'), /Malformed/);
});

test('CLI exits 1 for a failing palette and 0 for a passing palette', () => {
  const root = path.resolve('.tmp/codex8/b5-001/checker-fixture');
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  mkdirSync(path.join(root, 'src/styles'), { recursive: true });
  const script = path.join(root, 'scripts/check-contrast.mjs');
  const tokens = path.join(root, 'src/styles/tokens.css');
  copyFileSync(new URL('../scripts/check-contrast.mjs', import.meta.url), script);
  writeFileSync(tokens, fixture.replace('--text: var(--ink)', '--text: var(--paper)'));
  assert.equal(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status, 1);
  writeFileSync(tokens, fixture);
  assert.equal(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status, 0);
});

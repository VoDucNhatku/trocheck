import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error(`Expected an opaque hex color: ${hex}`);
    const channels = hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255);
    const linear = channels.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

function splitArguments(value) {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    if (value[i] === ')') depth--;
    if (value[i] === ',' && depth === 0) return [value.slice(0, i).trim(), value.slice(i + 1).trim()];
  }
  throw new Error(`Expected two light-dark arguments: ${value}`);
}

export function checkContrast(css) {
  const root = css.match(/:root\s*\{([\s\S]*?)\}/);
  if (!root) throw new Error('Missing :root token block');
  const declarations = [...root[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)];
  const tokens = new Map();
  for (const [, name, value] of declarations) {
    if (tokens.has(name) && tokens.get(name) !== value.trim()) {
      throw new Error(`Ambiguous overridden token: ${name}`);
    }
    tokens.set(name, value.trim());
  }
  const pairs = [...css.matchAll(/@contrast\s+([\w-]+)\s+(--[\w-]+)\s+(--[\w-]+)\s+(4\.5|3)\s*\*\//g)];
  if (!pairs.length) throw new Error('No @contrast pairs declared in tokens.css');
  if (pairs.length !== (css.match(/@contrast\b/g) ?? []).length) throw new Error('Malformed @contrast declaration');
  if (new Set(pairs.map((pair) => pair[1])).size !== pairs.length) throw new Error('Duplicate @contrast pair name');
  const resolve = (name, mode, seen = new Set()) => {
    if (seen.has(name)) throw new Error(`Cyclic token: ${name}`);
    if (!tokens.has(name)) throw new Error(`Missing token: ${name}`);
    seen.add(name);
    let value = tokens.get(name);
    if (value.startsWith('light-dark(') && value.endsWith(')')) {
      value = splitArguments(value.slice(11, -1))[mode === 'light' ? 0 : 1];
    }
    const alias = value.match(/^var\((--[\w-]+)\)$/);
    return alias ? resolve(alias[1], mode, seen) : value;
  };
  return ['light', 'dark'].flatMap((mode) => pairs.map(([, name, foreground, background, minimum]) => {
    const ratio = contrastRatio(resolve(foreground, mode), resolve(background, mode));
    return { mode, pair: name, foreground, background, ratio, minimum: Number(minimum), pass: ratio >= Number(minimum) };
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
    const results = checkContrast(css);
    console.table(results.map((row) => ({
      mode: row.mode, pair: row.pair, foreground: row.foreground, background: row.background,
      ratio: row.ratio.toFixed(2), minimum: row.minimum, result: row.pass ? 'PASS' : 'FAIL',
    })));
    const failed = results.filter((row) => !row.pass);
    console.log(`${results.length} pairs checked; ${failed.length} below threshold (light and dark).`);
    process.exitCode = failed.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

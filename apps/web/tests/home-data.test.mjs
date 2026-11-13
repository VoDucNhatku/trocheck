import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

test('home renders API counts, safe small samples, demo labels and neutral failures on the server', async () => {
  const root = process.cwd();
  const output = path.resolve('../../.tmp/j-home-data.cjs');
  await mkdir(path.dirname(output), { recursive: true });
  await build({ absWorkingDir: root, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile: output,
    stdin: { resolveDir: root, sourcefile: 'home-data-fixture.tsx', loader: 'tsx', contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { HomeStats } from './src/features/landing/HomeStats';
      import { HomeMarket } from './src/features/landing/HomeMarket';
      import { getHomeOverview } from './src/features/landing/market';
      export const stats = data => renderToStaticMarkup(<HomeStats data={data} />);
      export const market = async demo => renderToStaticMarkup(await HomeMarket({demo}));
      export const overview = getHomeOverview;
    ` }, plugins: [{ name: 'server-fixture', setup(builder) {
      builder.onResolve({ filter: /^(server-only|next\/link|\.\/ScrollReveal)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', contents: args.path === 'server-only' ? '' : args.path === 'next/link'
        ? 'import React from "react"; export default function Link(props) { return <a {...props}/>; }'
        : 'import React from "react"; export function SideBlock({children}) { return <div>{children}</div>; }', resolveDir: root }));
      builder.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: 'export default {}', loader: 'js' }));
    } }],
  });
  const view = createRequire(import.meta.url)(output);
  const stats = { total_listings: 1234, eligible_listings: 4, updated_at: '2026-11-13T00:00:00Z', is_demo: false, excluded_counts: {} };
  const html = view.stats(stats);
  assert.match(html, /1\.234/);
  assert.match(html, /tin đã xử lý/);
  assert.match(html, /13\/11\/2026/);
  assert.doesNotMatch(html, /Số liệu demo|28\/10|NaN/);
  assert.match(view.stats({ ...stats, is_demo: true }), /Số liệu demo/);
  assert.match(view.stats(null), /Chưa tải được số liệu/);
  assert.doesNotMatch(view.stats(null), /data-count|Số liệu demo/);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async request => {
      assert.equal(request.next.revalidate, 60);
      return new URL(request.url).pathname.endsWith('/overview') ? Response.json(stats) : Response.json({
      cells: [{ ward_code: 'test', ward_name: 'Phường thử', property_type: 'ccmn', basis: 'per_unit', n: 1, n_per_m2: 1, mean_vnd: 9999999, mean_per_m2: 9999 }], min_n: 10, is_demo: false, data_to: null,
      });
    };
    assert.deepEqual(await view.overview(), stats);
    const small = await view.market();
    assert.match(small, /Chưa đủ tin để tính/);
    assert.doesNotMatch(small, /9,99|Dữ liệu demo/);
    assert.match(small, /demo=false/);
    globalThis.fetch = async () => Response.json({ cells: [{ ward_code: 'test', ward_name: 'Phường thử', property_type: 'ccmn', basis: 'per_unit', n: 10, n_per_m2: 10, mean_vnd: 4200000 }], min_n: 10, is_demo: true, data_to: '2026-11-13' });
    const sufficient = await view.market(true);
    assert.match(sufficient, /4,2 tr/);
    assert.match(sufficient, /\/tháng/);
    assert.match(sufficient, /Dữ liệu demo/);
    globalThis.fetch = async () => Response.json({ cells: [], min_n: 10, is_demo: false, data_to: null });
    assert.match(await view.market(), /Chưa đủ tin để tính giá thuê trung bình/);
    globalThis.fetch = async () => Response.json({}, { status: 503 });
    assert.equal(await view.overview(), null);
    assert.match(await view.market(), /Chưa tải được giá tham khảo/);
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    assert.equal(await view.overview(), null);
    assert.doesNotMatch(await view.market(), /Số liệu demo|9,99/);
  } finally { globalThis.fetch = original; }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenerApi, ApiError } from '../src/lib/api/http';
import { collectCatalog } from '../src/lib/api/catalog';
import { parseFilters, searchUrl } from '../src/features/listings/filters';
import { formatDate, rentHeadline } from '../src/lib/format';
import { segment } from '../src/lib/evidence';
import type { components } from '../src/lib/api/generated';

test('URL prices convert once; repeated query keys, pagination and no-store reach API', async () => {
  const query = parseFilters({ phuong: ['Cầu Giấy', 'Yên Hòa'], loai: ['ccmn', 'phong_tro'], gia_max: '4,5', trang: '2', demo: 'false' });
  assert.equal(query.price_max, 4_500_000);
  const api = createRenerApi('http://localhost:8000/api/v1', 1000, async (request) => {
    const r = request as Request;
    const url = new URL(r.url);
    assert.deepEqual(url.searchParams.getAll('ward'), ['Cầu Giấy', 'Yên Hòa']);
    assert.deepEqual(url.searchParams.getAll('type'), ['ccmn', 'phong_tro']);
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('demo'), 'false');
    assert.equal(r.cache, 'no-store');
    return Response.json({ items: [], total: 0, hidden_no_price: 0, page: 2, page_size: 20, data_as_of: null, is_demo: false });
  });
  await api.listings(query);
  const href = searchUrl({ phuong: ['a', 'b'], demo: 'false', gia_max: '4', trang: '3' }, 2);
  assert.equal(new URL(href, 'http://web').searchParams.getAll('phuong').length, 2);
  assert.match(href, /trang=2/);
  assert.doesNotMatch(searchUrl({ trang: '3', demo: 'false' }), /trang=/);
});

test('transport distinguishes 404, standard 503, invalid JSON, network and timeout', async () => {
  for (const status of [404, 503]) {
    const api = createRenerApi('http://api', 100, async () => Response.json({ error: { code: 'test', message: 'Thông báo API', request_id: 'req-1' } }, { status }));
    await assert.rejects(api.listing('id'), (e: unknown) => e instanceof ApiError && e.status === status && e.requestId === 'req-1');
  }
  await assert.rejects(createRenerApi('http://api', 100, async () => new Response('bad json')).overview(), (e: unknown) => e instanceof ApiError && e.code === 'invalid_response');
  await assert.rejects(createRenerApi('http://api', 100, async () => { throw new TypeError('offline'); }).overview(), (e: unknown) => e instanceof ApiError && e.code === 'network_error');
  await assert.rejects(createRenerApi('http://api', 10, async (request) => new Promise((_resolve, reject) => {
    (request as Request).signal.addEventListener('abort', () => reject(new Error('aborted')));
  })).overview(), (e: unknown) => e instanceof ApiError && e.code === 'timeout');
});

test('ward catalog walks all unfiltered pages, including beyond page 1', async () => {
  const pages: number[] = [];
  const result = await collectCatalog(async (page) => {
    pages.push(page);
    return { items: [{ listing_id: String(page), property_type: 'ccmn', ward_name: page === 1 ? 'A' : 'B', landmark: null, rent: { visibility: 'not_stated', amount_form: 'none', basis: 'unknown', period: 'unknown' }, area_m2: null, fees: [], posted_at: null, verdict: null, delta_percent: null, review_status: 'approved', is_demo: true, text_complete: true }], total: 101, hidden_no_price: 0, data_as_of: null, page_size: 100, page, is_demo: true };
  });
  assert.deepEqual(pages, [1, 2]);
  assert.deepEqual(result.wards, ['A', 'B']);
});

test('null dates, range/from/person/day prices and Unicode evidence stay truthful', () => {
  assert.equal(formatDate(null), 'Chưa rõ ngày');
  assert.equal(formatDate('bad'), 'Chưa rõ ngày');
  assert.equal(rentHeadline({ visibility: 'disclosed', amount_form: 'starting_from', min_vnd: 3_000_000, basis: 'per_unit', period: 'month' }).main, 'Từ 3 tr');
  assert.equal(rentHeadline({ visibility: 'disclosed', amount_form: 'range', min_vnd: 3_000_000, max_vnd: 3_500_000, basis: 'per_person', period: 'day' }).suffix, '/ngày/người');
  assert.equal(rentHeadline({ visibility: 'hidden_explicit', amount_form: 'none', basis: 'unknown', period: 'unknown' }).missing, true);
  const text = '🏠 Giá 3tr5';
  const pieces = segment(text, [{ start: 6, end: 10, quote: '3tr5', label: 'PRICE', method: 'regex' }]);
  assert.equal(pieces.map((p) => p.text).join(''), text);
  assert.equal(pieces.find((p) => p.span)?.text, '3tr5');
});

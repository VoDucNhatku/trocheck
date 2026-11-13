import test from 'node:test';
import assert from 'node:assert/strict';
import { activeFilterCount, areaLabel, comparisonText, DEFAULT_QUERY, hasAnyFilter, myPostsApiQuery, myPostsUrlQuery,
  parseMyPostsQuery, placeText, resultPhrases, safeOriginalLink, STATUS_LABEL, statusExplanation, wideningAdvice, type MyPost } from './my-posts-model';
import { workspaceRouteAllowed } from '../../lib/workspace/safe-path';

const post = { status: 'needs_review', reason_codes: [], listings: [] } as unknown as MyPost;
test('all server post states have Vietnamese labels and plain explanations', () => {
  assert.equal(Object.keys(STATUS_LABEL).length, 6);
  for (const status of Object.keys(STATUS_LABEL) as MyPost['status'][]) {
    assert.ok(STATUS_LABEL[status]);
    assert.ok(statusExplanation({ ...post, status }).length > 15);
  }
  assert.match(statusExplanation({ ...post, reason_codes: ['basis_unknown'] }), /phòng hay người/);
  assert.match(statusExplanation({ ...post, reason_codes: ['former_ward_split'] }), /nhiều phường mới/);
  assert.match(statusExplanation({ ...post, reason_codes: ['outside_hcm_province'] }), /ngoài phạm vi/);
  assert.equal(statusExplanation({ ...post, listings: [{ ward_code: null }] as MyPost['listings'] }), 'Chưa rõ phường.');
  assert.doesNotMatch(statusExplanation({ ...post, reason_codes: ['unknown_internal_code'] }), /unknown_internal_code/);
});

test('comparison preserves server formula and never invents a percentage for missing data', () => {
  const missing = comparisonText({ status: 'insufficient_data', n: 2 } as Parameters<typeof comparisonText>[0]);
  assert.match(missing, /Chưa đủ tin/); assert.doesNotMatch(missing, /%/);
  const message = 'Cao hơn mức trung bình (+12%) của 10 tin cùng phường.';
  assert.equal(comparisonText({ status: 'ok', message } as Parameters<typeof comparisonText>[0]), message);
});

test('private GET proxy paths are allowed and unsafe original links are rejected', () => {
  for (const path of ['me/posts', 'me/posts/summary']) {
    assert.equal(workspaceRouteAllowed(path, 'GET'), true);
    assert.equal(workspaceRouteAllowed(path, 'POST'), false);
  }
  assert.equal(workspaceRouteAllowed('me/posts/other-user', 'GET'), false);
  assert.equal(safeOriginalLink('javascript:alert(1)'), null);
  assert.equal(safeOriginalLink('https://www.facebook.com/groups/1/posts/2/'), 'https://www.facebook.com/groups/1/posts/2/');
});

test('filters proxy path is a private GET only', () => {
  assert.equal(workspaceRouteAllowed('me/posts/filters', 'GET'), true);
  assert.equal(workspaceRouteAllowed('me/posts/filters', 'POST'), false);
  assert.equal(workspaceRouteAllowed('me/posts/filters/extra', 'GET'), false);
});

test('URL query parsing reads every filter, converts million VND and drops bad values', () => {
  const q = parseMyPostsQuery('?nhom=waiting&khu_vuc=quan-1&khu_vuc=quan-3&khu_vuc=quan-1&gia_min=2,5&gia_max=5&dt_min=20&loai=phong_tro&loai=villa&sap_xep=price_asc&ca_khong_thue=1&trang=3');
  assert.deepEqual(q, { group: 'waiting', page: 3, areas: ['quan-1', 'quan-3'], types: ['phong_tro'], priceMin: 2_500_000,
    priceMax: 5_000_000, areaMin: 20, sort: 'price_asc', includeNotRental: true });
  assert.deepEqual(parseMyPostsQuery(''), DEFAULT_QUERY);
  const bad = parseMyPostsQuery('nhom=x&khu_vuc=Quan%201&khu_vuc=../x&gia_min=-1&gia_max=abc&dt_min=&sap_xep=bad&trang=0&ca_khong_thue=0');
  assert.deepEqual(bad, DEFAULT_QUERY);
  assert.equal(parseMyPostsQuery('gia_min=6&gia_max=4').priceMax, undefined);
});

test('URL and API queries round-trip, defaults stay out of the address', () => {
  assert.equal(myPostsUrlQuery(DEFAULT_QUERY), '');
  const text = 'nhom=published&khu_vuc=quan-1&khu_vuc=binh-thanh&gia_min=2.5&gia_max=5&dt_min=20&loai=phong_tro&loai=ccmn&sap_xep=area_desc&ca_khong_thue=1&trang=2';
  assert.equal(myPostsUrlQuery(parseMyPostsQuery(text)), text);
  const api = new URLSearchParams(myPostsApiQuery(parseMyPostsQuery(text)));
  assert.deepEqual(api.getAll('area'), ['quan-1', 'binh-thanh']);
  assert.deepEqual(api.getAll('type'), ['phong_tro', 'ccmn']);
  assert.equal(api.get('price_min'), '2500000'); assert.equal(api.get('price_max'), '5000000');
  assert.equal(api.get('area_min'), '20'); assert.equal(api.get('sort'), 'area_desc');
  assert.equal(api.get('rental_only'), 'false'); assert.equal(api.get('group'), 'published');
  assert.equal(api.get('page'), '2'); assert.equal(api.get('limit'), '20');
  assert.equal(new URLSearchParams(myPostsApiQuery(DEFAULT_QUERY)).get('rental_only'), 'true');
});

test('filter counts, labels, result line and widening advice', () => {
  const q = parseMyPostsQuery('khu_vuc=quan-1&gia_max=5&dt_min=20&loai=ccmn');
  assert.equal(activeFilterCount(q), 4);
  assert.equal(activeFilterCount({ ...DEFAULT_QUERY, group: 'published', sort: 'price_asc', includeNotRental: true }), 0);
  assert.equal(hasAnyFilter({ ...DEFAULT_QUERY, sort: 'price_asc' }), true);
  assert.equal(areaLabel('Quận 1'), 'Quận 1 (cũ)');
  assert.deepEqual(resultPhrases({ matched_listings: 12, total_sent: 200 }), ['12 phòng khớp', '200 bài đã gửi']);
  const advice = wideningAdvice(q).join(' ');
  assert.match(advice, /khu vực/); assert.match(advice, /giá đến/); assert.match(advice, /diện tích/); assert.match(advice, /loại phòng/);
  assert.match(wideningAdvice(DEFAULT_QUERY).join(' '), /không phải cho thuê/);
});

test('place text names the ward, else the old district with its source, else says unknown', () => {
  assert.equal(placeText({ ward_name: 'Phường Sài Gòn', old_districts: [] }), 'Phường Sài Gòn');
  assert.equal(placeText({ ward_name: null, old_districts: [{ key: 'quan-1', name: 'Quận 1' }] }), 'Quận 1 (cũ) · chưa rõ phường');
  assert.equal(placeText({ ward_name: null, old_districts: [{ key: 'quan-10', name: 'Quận 10' }, { key: 'quan-11', name: 'Quận 11' }] }),
    'Quận 10 (cũ), Quận 11 (cũ) · chưa rõ phường');
  assert.equal(placeText({ ward_name: null, old_districts: [] }), 'Chưa rõ phường');
});

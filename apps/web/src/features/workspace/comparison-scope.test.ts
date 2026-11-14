import assert from 'node:assert/strict';
import test from 'node:test';
import { comparisonPlace, comparisonScopeNote, isDistrictScope, POOL_LABEL } from './comparison-scope';
import { comparisonText } from './my-posts-model';
import { REASON_TEXT } from '../../lib/format';

test('the ward tier has no scope note and keeps the ward as the place', () => {
  assert.equal(comparisonScopeNote({ scope: 'ward', scope_label: 'Phường A', pool: 'accepted' }), null);
  assert.equal(comparisonScopeNote(undefined), null);
  assert.equal(comparisonScopeNote({}), null);  // older responses have no scope fields
  assert.equal(comparisonPlace({ scope: 'ward', scope_label: 'Phường A', pool: 'accepted' }, 'Phường A'), 'Phường A');
  assert.equal(comparisonPlace({}, null), 'Chưa rõ phường');
  assert.equal(isDistrictScope({ scope: 'ward' }), false);
});

test('the old-district tier always says district, not the same ward, and which pool', () => {
  assert.equal(comparisonScopeNote({ scope: 'old_district', scope_label: 'Bình Thạnh (cũ)', pool: 'accepted' }),
    'So với tin ở Bình Thạnh (cũ) · không cùng phường · chỉ gồm tin đã duyệt');
  const checked = comparisonScopeNote({ scope: 'old_district', scope_label: 'Quận 12 (cũ)', pool: 'auto_checked' })!;
  assert.equal(checked, 'So với tin ở Quận 12 (cũ) · không cùng phường · gồm tin chưa duyệt, đã qua kiểm tra tự động');
  assert.ok(checked.includes(POOL_LABEL.auto_checked));
  assert.equal(comparisonPlace({ scope: 'old_district', scope_label: 'Quận 12 (cũ)', pool: 'accepted' }, 'Phường X'), 'Quận 12 (cũ)');
});

test('a district-level message is passed through unchanged and never loses its scope', () => {
  const message = 'Thấp hơn mức trung bình (-8,0%) của 23 tin phòng trọ ở Bình Thạnh (cũ) (không cùng phường, gồm tin chưa duyệt, đã qua kiểm tra tự động).';
  const c = { status: 'ok', message, scope: 'old_district', scope_label: 'Bình Thạnh (cũ)', pool: 'auto_checked', n: 23 } as Parameters<typeof comparisonText>[0];
  assert.equal(comparisonText(c), message);
  assert.ok(comparisonText(c).includes('không cùng phường') && comparisonText(c).includes('gồm tin chưa duyệt'));
  const few = { status: 'insufficient_data', message: 'x', scope: 'old_district', scope_label: 'Bình Thạnh (cũ)', pool: 'auto_checked', n: 6 } as Parameters<typeof comparisonText>[0];
  assert.equal(comparisonText(few), 'Chưa đủ tin ở Bình Thạnh (cũ) để so (6 tin tương tự, không cùng phường, gồm tin chưa duyệt, đã qua kiểm tra tự động).');
  const ward = { status: 'insufficient_data', message: 'x', scope: 'ward', scope_label: null, pool: 'accepted', n: 2 } as Parameters<typeof comparisonText>[0];
  assert.equal(comparisonText(ward), 'Chưa đủ tin trong khu vực để so (2 tin tương tự).');
});

test('relaxed district scope says all areas for both pools', () => {
  for (const pool of ['accepted', 'auto_checked'] as const) {
    const c = { scope: 'old_district', scope_label: 'Thủ Đức (cũ)', pool, reason_codes: ['area_band_relaxed'] } as const;
    const scoped = { ...c, reason_codes: [...c.reason_codes] };
    assert.equal(comparisonScopeNote(scoped), `So với tin ở Thủ Đức (cũ) · không cùng phường · ${POOL_LABEL[pool]} · mọi diện tích`);
    assert.equal(comparisonScopeNote({ ...scoped, reason_codes: ['area_missing_broad_group'] }),
      `So với tin ở Thủ Đức (cũ) · không cùng phường · ${POOL_LABEL[pool]}`);
  }
  assert.equal(REASON_TEXT.area_band_relaxed, 'Nhóm quận cũ chưa đủ tin cùng diện tích, so với mọi diện tích');
});

test('my-posts sentences preserve the relaxed-area note', () => {
  const message = 'Gần mức trung bình (+0,0%) của 12 tin phòng trọ ở Thủ Đức (cũ) (không cùng phường, chỉ gồm tin đã duyệt, mọi diện tích).';
  const c = { status: 'ok', message, scope: 'old_district', scope_label: 'Thủ Đức (cũ)', pool: 'accepted', n: 12,
    reason_codes: ['area_band_relaxed'] } as Parameters<typeof comparisonText>[0];
  assert.equal(comparisonText(c), message);
  assert.equal(comparisonText({ ...c, status: 'insufficient_data', n: 6 }),
    'Chưa đủ tin ở Thủ Đức (cũ) để so (6 tin tương tự, không cùng phường, chỉ gồm tin đã duyệt, mọi diện tích).');
});

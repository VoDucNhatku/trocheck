import assert from 'node:assert/strict';
import test from 'node:test';
import { comparisonPlace, comparisonScopeNote, isDistrictScope, POOL_LABEL } from './comparison-scope';
import { comparisonText } from './my-posts-model';

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

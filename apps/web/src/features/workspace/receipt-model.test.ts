import test from 'node:test';
import assert from 'node:assert/strict';
import type { Evidence, Fee, Listing } from '@/lib/api/types';
import { groundedEvidence, receiptFee, receiptFields, receiptRent } from './receipt-model';

test('rent cannot assert an amount from evidence cut inside a money token', () => {
  const render = (text: string, quote: string, amount = 4000000) => {
    const start = Array.from(text.slice(0, text.indexOf(quote))).length;
    const listing = { rent: { visibility: 'disclosed', amount_form: 'exact', amount_vnd: amount, period: 'month', basis: 'unknown', evidence: [{ start, end: start + Array.from(quote).length, quote }] } } as Listing;
    return receiptRent(listing, text);
  };
  for (const [text, quote] of [['🏠 Giá #4tr7', '4tr'], ['Giá 14tr', '4tr'], ['Giá 4,7tr', '4'], ['Giá 4.700.000đ', '4.700']]) {
    const rent = render(text, quote);
    assert.equal(rent.main, 'Chưa xác định');
    assert.equal(rent.unverified, true);
    assert.ok(rent.reason);
    assert.equal(rent.suffix, '');
  }
  assert.equal(render('🏠 Giá #4tr7', '4tr7', 4700000).main, '4.700.000 đ');
  for (const [text, quote] of [['Giá 4tr/tháng', '4tr'], ['Giá 4tr, điện riêng', '4tr']]) {
    assert.equal(render(text, quote).unverified, false);
  }
});

test('evidence uses code points and rejects mismatched or invalid spans', () => {
  const valid = { start: 2, end: 10, quote: 'Cầu Giấy', label: 'LOC' } as Evidence;
  assert.deepEqual(groundedEvidence('🏠 Cầu Giấy', [valid, { ...valid, start: 3 }, { ...valid, end: 99 }]), [valid]);
});
test('rent guard preserves ranges, starting prices, hidden and missing prices', () => {
  const text = 'Giá 3–4tr/tháng';
  const base = { visibility: 'disclosed', period: 'month', basis: 'per_unit', evidence: [{ start: 4, end: 9, quote: '3–4tr' }] };
  const range = receiptRent({ rent: { ...base, amount_form: 'range', min_vnd: 3000000, max_vnd: 4000000 } } as Listing, text);
  assert.equal(range.unverified, false);
  assert.match(range.main, /3.*4/);
  const from = receiptRent({ rent: { ...base, amount_form: 'starting_from', min_vnd: 3000000 } } as Listing, text);
  assert.equal(from.unverified, false);
  assert.match(from.main, /^Từ/);
  const hidden = receiptRent({ rent: { ...base, amount_form: 'none', visibility: 'hidden_explicit', evidence: [] } } as unknown as Listing, 'ib giá');
  assert.equal(hidden.unverified, false);
  assert.equal(hidden.main, 'Bài không công khai giá');
  const missing = receiptRent({ rent: { ...base, amount_form: 'none', visibility: 'not_stated', evidence: [] } } as unknown as Listing, 'Phòng có gác');
  assert.equal(missing.main, 'Không đề cập');
  assert.equal(missing.unverified, false);
  const ungrounded = receiptRent({ rent: { ...base, amount_form: 'exact', amount_vnd: 4000000, evidence: [{ start: 0, end: 3, quote: '4tr' }] } } as Listing, text);
  assert.equal(ungrounded.main, 'Chưa xác định');
});
test('fees preserve unknown periods and Vietnamese fractional deposits', () => {
  assert.equal(receiptFee({ type: 'internet', unit: 'unknown', amount_vnd: 70000 } as Fee), '70.000 đ · chưa rõ kỳ');
  assert.equal(receiptFee({ type: 'deposit', unit: 'months_of_rent', months: 1.5 } as Fee), '1,5 tháng tiền thuê');
  assert.equal(receiptFee({ type: 'water', unit: 'per_m3', amount_vnd: 30000 } as Fee), '30.000 đ /khối');
  assert.equal(receiptFee({ type: 'internet', unit: 'unknown', free: true } as Fee), 'Miễn phí');
});
test('receipt excludes invented landmarks and does not turn available units into bedrooms', () => {
  const text = '20 phòng tại Cầu Giấy';
  const listing: Listing = {
    listing_id: 'receipt-test', listing_index: 0, fees: [], review_status: 'needs_review',
    rent: { decision: 'abstained', evidence: [], amount_form: 'none', visibility: 'not_stated', basis: 'unknown', period: 'unknown', includes: [] },
    area: { decision: 'abstained', evidence: [], amount_form: 'none' },
    room: { decision: 'answered', evidence: [{ start: 3, end: 8, quote: 'phòng', label: 'ROOM', method: 'regex' }], property_type: 'unknown', furnishing: 'unknown' },
    location: { decision: 'answered', resolution: 'exact', ward_name: 'Cầu Giấy', street: null, landmark: 'Đại học Quốc gia', evidence: [{ start: 13, end: 21, quote: 'Cầu Giấy', label: 'LOC', method: 'regex' }] },
  };
  const fields = receiptFields(listing, text);
  assert.equal(fields.find(field => field.title === 'Vị trí')?.value, 'Cầu Giấy');
  assert.equal(fields.find(field => field.title === 'Phòng & tiện nghi')?.value, 'Chưa xác định tiện nghi');
});

test('post-001 receipt keeps grounded room amenities from the API listing', () => {
  const text = 'Mình còn chung cư mini ở Cầu Giấy. Diện tích 30 m², có gác, WC riêng, nội thất cơ bản.';
  const roomEvidence = [{ start: 52, end: 85, quote: 'có gác, WC riêng, nội thất cơ bản', label: 'ROOM', method: 'regex' }] as Evidence[];
  const listing: Listing = {
    listing_id: 'post-001', listing_index: 0, fees: [], review_status: 'needs_review',
    rent: { decision: 'answered', evidence: [], amount_form: 'none', visibility: 'not_stated', basis: 'unknown', period: 'unknown', includes: [] },
    area: { decision: 'answered', evidence: [{ start: 45, end: 50, quote: '30 m²', label: 'AREA', method: 'regex' }], amount_form: 'exact', value_m2: 30 },
    room: { decision: 'answered', evidence: roomEvidence, property_type: 'ccmn', bedrooms: 0, bathrooms: 1, mezzanine: true, private_bathroom: true, furnishing: 'basic' },
    location: { decision: 'answered', resolution: 'exact', ward_name: 'Cầu Giấy', street: null, landmark: null, evidence: [{ start: 25, end: 33, quote: 'Cầu Giấy', label: 'LOC', method: 'regex' }] },
  };
  const field = receiptFields(listing, text).find(item => item.title === 'Phòng & tiện nghi');
  assert.equal(field?.value, 'Không có phòng ngủ riêng · 1 phòng tắm · Có gác · WC riêng · Nội thất cơ bản');
  assert.deepEqual(field?.evidence, roomEvidence);
});

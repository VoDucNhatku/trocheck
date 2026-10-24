import assert from 'node:assert/strict';
import test from 'node:test';
import type { Fee } from '@/lib/api/types';
import { listingFee, listingRent } from './listing-format';

test('listing money preserves visibility, period, basis and Vietnamese decimals', () => {
  const rent = { visibility: 'disclosed', amount_form: 'exact', amount_vnd: 12_500_000, basis: 'per_unit', period: 'month' } as const;
  assert.deepEqual(listingRent(rent), { main: '12,5 tr', suffix: '/tháng', missing: false });
  assert.equal(listingRent({ ...rent, basis: 'per_person', period: 'day' }).suffix, '/ngày/người');
  assert.equal(listingRent({ ...rent, visibility: 'hidden_explicit' }).missing, true);
  assert.equal(listingRent({ ...rent, visibility: 'not_stated' }).main, 'Bài không nêu giá cụ thể');
  assert.equal(listingRent({ ...rent, amount_vnd: null }).missing, true);
  assert.equal(listingRent({ ...rent, amount_form: 'starting_from', min_vnd: 3_000_000 }).main, 'Từ 3 tr');
  assert.equal(listingRent({ ...rent, amount_form: 'range', min_vnd: 3_000_000, max_vnd: 3_500_000 }).main, '3 tr–3,5 tr');
});

test('listing fees keep deposits separate, null distinct from zero, and monthly units', () => {
  const fee = { type: 'deposit', unit: 'months_of_rent', months: 1.5, amount_vnd: null, free: false, state_rate: false } as Fee;
  assert.equal(listingFee(fee), '1,5 tháng tiền thuê');
  assert.equal(listingFee({ ...fee, months: 0 }), '0 tháng tiền thuê');
  assert.equal(listingFee({ ...fee, months: null }), 'Có nhắc, chưa rõ số');
  assert.equal(listingFee({ ...fee, free: true }), 'Miễn phí');
  assert.equal(listingFee({ ...fee, state_rate: true }), 'Giá nhà nước');
  assert.equal(listingFee({ ...fee, type: 'service', unit: 'per_unit_month', amount_vnd: 150_000 }), '150.000 đ/tháng');
});

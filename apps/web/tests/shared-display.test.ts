import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatArea, formatDecimal, formatFee, formatRent } from '../src/lib/display-format';

test('shared formatting preserves Vietnamese currency, decimal and monthly units', () => {
  assert.equal(formatRent(4400000, 'per_unit'), '4.400.000 đ/tháng');
  assert.equal(formatRent(1500000, 'per_person'), '1.500.000 đ/tháng/người');
  assert.equal(formatArea(25.5), '25,5 m²');
  assert.equal(formatDecimal(10), '10,0');
  assert.equal(formatFee({ type: 'deposit', months: 1.5, unit: 'months_of_rent' }), 'Cọc · 1,5 tháng tiền thuê');
  assert.equal(formatFee({ type: 'electricity', amount_vnd: 3500, unit: 'per_kwh' }), 'Điện · 3.500 đ/số');
  assert.equal(formatFee({ type: 'service', amount_vnd: 100000, unit: 'per_unit_month' }), 'Dịch vụ · 100.000 đ/tháng');
});

test('missing values are not zero and fee qualifiers remain explicit', () => {
  assert.equal(formatRent(null), 'Không đề cập');
  assert.equal(formatArea(Number.NaN), 'Không đề cập');
  assert.equal(formatFee({ type: 'water', unit: 'unknown' }), 'Nước · Không đề cập');
  assert.equal(formatFee({ type: 'other', unit: 'unknown', amount_vnd: 45000 }), 'Khác · 45.000 đ · chưa rõ kỳ');
  assert.equal(formatFee({ type: 'internet', unit: 'per_unit_month', free: true }), 'Internet · Miễn phí');
  assert.equal(formatFee({ type: 'electricity', unit: 'per_kwh', state_rate: true }), 'Điện · Giá nhà nước');
});

import type { Fee } from './api/types';
import { formatVnd, FEE_LABEL } from './format';

export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Shared user-facing formatting for the component layer. */
export function formatArea(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? 'Không đề cập' : `${value.toLocaleString('vi-VN')} m²`;
}

export function formatRent(value: number | null | undefined, basis: 'per_unit' | 'per_person' | 'unknown' = 'unknown'): string {
  if (value == null || !Number.isFinite(value)) return 'Không đề cập';
  const suffix = basis === 'per_person' ? '/tháng/người' : '/tháng';
  return `${formatVnd(value)}${suffix}`;
}

export function formatFee(fee: Pick<Fee, 'type' | 'amount_vnd' | 'unit' | 'months' | 'free' | 'state_rate'>): string {
  if (fee.free) return `${FEE_LABEL[fee.type]} · Miễn phí`;
  if (fee.state_rate) return `${FEE_LABEL[fee.type]} · Giá nhà nước`;
  if (fee.type === 'deposit' && fee.months != null) return `${FEE_LABEL[fee.type]} · ${formatDecimal(fee.months)} tháng tiền thuê`;
  if (fee.amount_vnd == null) return `${FEE_LABEL[fee.type]} · Không đề cập`;
  const unit = fee.unit === 'per_kwh' ? '/số' : fee.unit === 'per_m3' ? '/khối' : fee.unit === 'per_person_month' ? '/người/tháng' : fee.unit === 'per_unit_month' ? '/tháng' : fee.unit === 'one_time' ? ' · một lần' : ' · chưa rõ kỳ';
  return `${FEE_LABEL[fee.type]} · ${formatVnd(fee.amount_vnd)}${unit}`;
}

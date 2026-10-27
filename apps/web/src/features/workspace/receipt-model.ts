import type { Evidence, Fee, Listing } from '@/lib/api/types';
import { FEE_LABEL, PROPERTY_LABEL, formatVnd, rentHeadline } from '@/lib/format';

export function groundedEvidence(text: string, evidence: Evidence[] | null | undefined): Evidence[] {
  const points = Array.from(text);
  return (evidence ?? []).filter(value => value.start >= 0 && value.end > value.start && value.end <= points.length && points.slice(value.start, value.end).join('') === value.quote);
}
export function listingEvidence(listing: Listing, text: string) {
  return groundedEvidence(text, [...listing.rent.evidence, ...listing.area.evidence, ...listing.room.evidence, ...listing.location.evidence, ...listing.fees.flatMap(fee => fee.evidence ?? [])]);
}
export function receiptFee(fee: Fee) {
  if (fee.free) return 'Miễn phí';
  if (fee.state_rate) return 'Giá nhà nước';
  if (fee.type === 'deposit' && fee.months != null) return fee.months.toLocaleString('vi-VN') + ' tháng tiền thuê';
  if (fee.amount_vnd == null) return 'Có nhắc, không ghi số';
  const units: Record<Fee['unit'], string> = { per_kwh: ' /số', per_m3: ' /khối', per_person_month: ' /người/tháng', per_unit_month: ' /tháng', months_of_rent: '', one_time: ' · một lần', unknown: ' · chưa rõ kỳ' };
  return formatVnd(fee.amount_vnd) + units[fee.unit];
}
export function receiptRent(listing: Listing, text: string) {
  const rent = rentHeadline(listing.rent);
  const points = Array.from(text);
  const evidence = groundedEvidence(text, listing.rent.evidence);
  // A matching substring still cannot support a price when it cuts a money token
  // (e.g. "4tr" inside "4tr7"). Keep the quote; do not reparse or correct the API amount.
  const cut = evidence.some(value => {
    const before = points.slice(Math.max(0, value.start - 2), value.start).join('');
    const after = points.slice(value.end, value.end + 2).join('');
    return (/\d[.,]?$/.test(before) && /^\d/.test(value.quote)) || /^(?:\d|[.,]\d)/.test(after);
  });
  const unverified = !rent.missing && (!evidence.length || cut);
  const reason = unverified ? cut ? 'Đoạn giá trích xuất bị cắt giữa số tiền. Cần đối chiếu bài gốc và hỏi lại người đăng.' : 'Chưa có bằng chứng khớp bài gốc để xác định giá.' : '';
  return { main: unverified ? 'Chưa xác định' : listing.rent.amount_form === 'exact' && listing.rent.amount_vnd != null && !rent.missing ? formatVnd(listing.rent.amount_vnd) : rent.missing && listing.rent.visibility !== 'hidden_explicit' ? 'Không đề cập' : rent.main, suffix: unverified ? '' : rent.suffix.replace('/phòng', ''), missing: rent.missing, unverified, reason };
}
export function receiptFields(listing: Listing, text: string) {
  const area = groundedEvidence(text, listing.area.evidence);
  const location = groundedEvidence(text, listing.location.evidence);
  const room = groundedEvidence(text, listing.room.evidence);
  const normalize = (value: string) => value.toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
  // A location subfield must be named in its evidence; inherited demo landmarks
  // and unrelated normalized values cannot become an assertion on the receipt.
  const places = [...new Set([listing.location.ward_name, listing.location.street, listing.location.landmark].filter((value): value is string => Boolean(value) && location.some(evidence => normalize(evidence.quote).includes(normalize(value!)))))];
  const amenities: string[] = [];
  if (room.length) {
    if (listing.room.bedrooms != null) amenities.push(listing.room.bedrooms === 0 ? 'Không có phòng ngủ riêng' : listing.room.bedrooms.toLocaleString('vi-VN') + ' phòng ngủ');
    if (listing.room.bathrooms != null) amenities.push(listing.room.bathrooms.toLocaleString('vi-VN') + ' phòng tắm');
    if (listing.room.mezzanine != null) amenities.push(listing.room.mezzanine ? 'Có gác' : 'Không có gác');
    if (listing.room.private_bathroom != null) amenities.push(listing.room.private_bathroom ? 'WC riêng' : 'WC chung');
    if (listing.room.furnishing !== 'unknown') amenities.push(({ full: 'Đầy đủ nội thất', basic: 'Nội thất cơ bản', none: 'Không nội thất' })[listing.room.furnishing]);
  }
  return [
    { title: 'Diện tích', value: !area.length ? 'Không đề cập' : listing.area.amount_form === 'exact' && listing.area.value_m2 != null ? listing.area.value_m2.toLocaleString('vi-VN') + ' m²' : listing.area.amount_form === 'range' && listing.area.min_m2 != null && listing.area.max_m2 != null ? listing.area.min_m2.toLocaleString('vi-VN') + '–' + listing.area.max_m2.toLocaleString('vi-VN') + ' m²' : 'Chưa xác định', evidence: area },
    { title: 'Loại phòng', value: room.length && listing.room.property_type !== 'unknown' ? PROPERTY_LABEL[listing.room.property_type] ?? 'Chưa xác định loại phòng' : 'Chưa xác định loại phòng', evidence: room },
    { title: 'Phòng & tiện nghi', value: amenities.join(' · ') || 'Chưa xác định tiện nghi', evidence: room },
    { title: 'Vị trí', value: places.join(' · ') || 'Chưa xác định vị trí', evidence: location },
  ];
}
export function feeLabel(fee: Fee) {
  if (fee.type === 'water' && fee.unit === 'per_m3') return 'Nước (theo khối)';
  if (fee.type === 'water' && fee.unit === 'per_person_month') return 'Nước (theo người)';
  return FEE_LABEL[fee.type];
}

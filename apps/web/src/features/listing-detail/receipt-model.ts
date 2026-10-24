import type { Evidence, Listing } from '@/lib/api/types';
import { PROPERTY_LABEL, formatVnd } from '@/lib/format';
import { FEE_LABEL, listingFee, listingRent } from '@/features/listings/listing-format';

export interface ReceiptRow { id: string; label: string; value: string; evidence: Evidence[]; section: 'fact' | 'fee' | 'deposit' }
export function groundedEvidence(text: string, values: Evidence[] | null | undefined): Evidence[] {
  const points = Array.from(text);
  return (values ?? []).filter(e => Number.isInteger(e.start) && Number.isInteger(e.end) && e.start >= 0 && e.end > e.start && e.end <= points.length && points.slice(e.start, e.end).join('') === e.quote);
}
export function receiptModel(listing: Listing, text: string) {
  const rentEvidence = groundedEvidence(text, listing.rent.evidence);
  const rent = listingRent(listing.rent);
  const price = !rentEvidence.length ? 'Không đề cập' : rent.missing ? listing.rent.visibility === 'hidden_explicit' ? rent.main : 'Không đề cập' : listing.rent.amount_form === 'exact' && listing.rent.amount_vnd != null ? formatVnd(listing.rent.amount_vnd) : rent.main;
  const area = listing.area, room = listing.room, location = listing.location;
  const areaEvidence = groundedEvidence(text, area.evidence), roomEvidence = groundedEvidence(text, room.evidence), locationEvidence = groundedEvidence(text, location.evidence);
  const amenities = [room.bedrooms != null ? room.bedrooms === 0 ? 'Không có phòng ngủ riêng' : `${room.bedrooms.toLocaleString('vi-VN')} phòng ngủ` : null, room.bathrooms != null ? `${room.bathrooms.toLocaleString('vi-VN')} phòng tắm` : null, room.private_bathroom == null ? null : room.private_bathroom ? 'WC riêng' : 'WC chung', room.mezzanine == null ? null : room.mezzanine ? 'Có gác' : 'Không có gác', room.furnishing === 'unknown' ? null : ({full:'Đầy đủ nội thất',basic:'Nội thất cơ bản',none:'Không nội thất'})[room.furnishing]].filter(Boolean).join(' · ');
  const rows: ReceiptRow[] = [
    { id:'area',label:'Diện tích',value:!areaEvidence.length?'Không đề cập':area.amount_form==='exact'&&area.value_m2!=null?`${area.value_m2.toLocaleString('vi-VN')} m²`:area.amount_form==='range'&&area.min_m2!=null&&area.max_m2!=null?`${area.min_m2.toLocaleString('vi-VN')}–${area.max_m2.toLocaleString('vi-VN')} m²`:'Không đề cập',evidence:areaEvidence,section:'fact' },
    { id:'room',label:'Loại phòng',value:roomEvidence.length&&room.property_type!=='unknown'?PROPERTY_LABEL[room.property_type]:'Không đề cập',evidence:roomEvidence,section:'fact' },
    { id:'amenities',label:'Phòng và tiện nghi',value:roomEvidence.length&&amenities?amenities:'Không đề cập',evidence:roomEvidence,section:'fact' },
    { id:'location',label:'Vị trí',value:locationEvidence.length?[location.landmark,location.street,location.ward_name,location.old_ward_name,location.old_district_name].filter(Boolean).join(' · ')||'Không đề cập':'Không đề cập',evidence:locationEvidence,section:'fact' },
  ];
  for (const [index,fee] of listing.fees.entries()) {
    const evidence=groundedEvidence(text,fee.evidence);
    rows.push({id:`fee-${index}`,label:fee.type==='deposit'?'Đặt cọc':FEE_LABEL[fee.type],value:evidence.length?listingFee(fee):'Không đề cập',evidence,section:fee.type==='deposit'?'deposit':'fee'});
  }
  return {price,suffix:rentEvidence.length&&!rent.missing?rent.suffix:'',rentEvidence,rows,evidence:[...rentEvidence,...rows.flatMap(row=>row.evidence)]};
}
export function comparisonReady(c: { status: string; n: number; mean_vnd?: number | null }) {
  return c.status === 'ok' && c.n >= 10 && c.mean_vnd != null && Number.isFinite(c.mean_vnd);
}
export function publicSource(value: string | null) { return value && !/qa-case-|qa-stress-|^[0-9A-HJKMNP-TV-Z]{26}$/i.test(value) ? value : null; }

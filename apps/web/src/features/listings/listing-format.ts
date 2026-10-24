import type { Rent, Fee } from '@/lib/api/types';
import { formatShort, formatVnd, FEE_LABEL } from '@/lib/format';

export function listingRent(rent: Pick<Rent, 'visibility'|'amount_form'|'amount_vnd'|'min_vnd'|'max_vnd'|'period'|'basis'>) {
  const suffix = `${rent.period==='month'?'/tháng':rent.period==='day'?'/ngày':''}${rent.basis==='per_person'?'/người':''}`;
  if(rent.visibility==='hidden_explicit') return {main:'Bài không công khai giá',suffix:'',missing:true};
  if(rent.visibility!=='disclosed') return {main:'Bài không nêu giá cụ thể',suffix:'',missing:true};
  if(rent.amount_form==='exact' && rent.amount_vnd!=null) return {main:formatShort(rent.amount_vnd),suffix,missing:false};
  if(rent.amount_form==='starting_from' && rent.min_vnd!=null) return {main:`Từ ${formatShort(rent.min_vnd)}`,suffix,missing:false};
  if(rent.amount_form==='range' && rent.min_vnd!=null && rent.max_vnd!=null) return {main:`${formatShort(rent.min_vnd)}–${formatShort(rent.max_vnd)}`,suffix,missing:false};
  return {main:'Chưa có giá',suffix:'',missing:true};
}

export function listingFee(fee: Fee): string {
  if(fee.free) return 'Miễn phí';
  if(fee.state_rate) return 'Giá nhà nước';
  if(fee.type==='deposit' && fee.months!=null) return `${fee.months.toLocaleString('vi-VN')} tháng tiền thuê`;
  if(fee.amount_vnd==null) return 'Có nhắc, chưa rõ số';
  const suffix: Record<Fee['unit'],string> = {per_kwh:'/số',per_m3:'/khối',per_person_month:'/người/tháng',per_unit_month:'/tháng',months_of_rent:'',one_time:' · một lần',unknown:' · chưa rõ kỳ'};
  return `${formatVnd(fee.amount_vnd)}${suffix[fee.unit]}`;
}
export { FEE_LABEL };

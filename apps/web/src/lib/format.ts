// Display helpers: enum → Vietnamese text, VND formatting. Never show raw enums or 0 for "missing".

import type { Comparison, ComparisonReason, Fee, FeeType, Label, ListingCard, Method, PropertyType, Rent, Verdict } from './api/types';

const vnd = new Intl.NumberFormat('vi-VN');

export function formatVnd(v: number): string {
  return `${vnd.format(v)} đ`;
}

/** 5500000 → "5,5 tr" ; 3500 → "3,5k" */
export function formatShort(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tr`;
  if (v >= 1_000) return `${(v / 1_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}k`;
  return vnd.format(v);
}

export function formatPercent(v: number): string {
  return `${Math.abs(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return 'Chưa rõ ngày';
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
}

export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return 'Chưa rõ ngày';
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
}

export const PROPERTY_LABEL: Record<PropertyType, string> = {
  phong_tro: 'Phòng trọ',
  ccmn: 'Chung cư mini',
  can_ho_dich_vu: 'Căn hộ dịch vụ',
  nha_nguyen_can: 'Nhà nguyên căn',
  unknown: 'Chưa rõ loại',
};

export const LABEL_TEXT: Record<Label, string> = {
  PRICE: 'GIÁ',
  AREA: 'DT',
  LOC: 'VT',
  ROOM: 'PN',
  FEE: 'PHÍ',
};

export const LABEL_NAME: Record<Label, string> = {
  PRICE: 'Giá thuê',
  AREA: 'Diện tích',
  LOC: 'Vị trí',
  ROOM: 'Loại / số phòng',
  FEE: 'Phí',
};

export const METHOD_LABEL: Record<Method, string> = {
  regex: 'Regex',
  llm: 'LLM',
  human: 'Nhãn chuẩn',
};

export const FEE_LABEL: Record<FeeType, string> = {
  deposit: 'Cọc',
  electricity: 'Điện',
  water: 'Nước',
  service: 'Dịch vụ',
  internet: 'Internet',
  parking: 'Gửi xe',
  other: 'Khác',
};

const UNIT_SUFFIX: Record<Fee['unit'], string> = {
  per_kwh: '/số',
  per_m3: '/khối',
  per_person_month: '/người/tháng',
  per_unit_month: '/phòng/tháng',
  months_of_rent: '',
  one_time: ' một lần',
  unknown: '',
};

export function feeValue(f: Fee): string {
  if (f.free) return 'Miễn phí';
  if (f.state_rate) return 'Giá nhà nước';
  if (f.type === 'deposit' && f.months) return `${f.months} tháng tiền thuê`;
  if (f.amount_vnd == null) return 'Có nhắc, không ghi số';
  return `${formatShort(f.amount_vnd)}${UNIT_SUFFIX[f.unit]}`;
}

export function feeLine(fees: Fee[]): string {
  if (!fees.length) return 'Chưa rõ phí';
  return fees.map((f) => `${FEE_LABEL[f.type]} ${feeValue(f).toLowerCase()}`).join(' · ');
}

export const BASIS_SUFFIX: Record<Rent['basis'], string> = {
  per_unit: '/tháng/phòng',
  per_person: '/tháng/người',
  unknown: '/tháng',
};

/** Headline price for cards and panels. Returns null text when there is no number to show. */
export function rentHeadline(rent: Pick<Rent, 'visibility' | 'amount_form' | 'amount_vnd' | 'min_vnd' | 'max_vnd' | 'basis' | 'period'>): {
  main: string;
  suffix: string;
  missing: boolean;
} {
  const suffix = `${rent.period === 'month' ? '/tháng' : rent.period === 'day' ? '/ngày' : ''}${rent.basis === 'per_person' ? '/người' : rent.basis === 'per_unit' ? '/phòng' : ''}`;
  if (rent.visibility === 'hidden_explicit') return { main: 'Bài không công khai giá', suffix: '', missing: true };
  if (rent.amount_form === 'exact' && rent.amount_vnd != null)
    return { main: formatShort(rent.amount_vnd), suffix, missing: false };
  if (rent.amount_form === 'starting_from' && rent.min_vnd != null)
    return { main: `Từ ${formatShort(rent.min_vnd)}`, suffix, missing: false };
  if (rent.amount_form === 'range' && rent.min_vnd != null && rent.max_vnd != null)
    return { main: `${formatShort(rent.min_vnd)}–${formatShort(rent.max_vnd)}`, suffix, missing: false };
  return { main: 'Chưa có giá', suffix: '', missing: true };
}

export const VERDICT_WORD: Record<Verdict, string> = {
  higher: 'Cao hơn',
  near: 'Gần',
  lower: 'Thấp hơn',
};

export function cardVerdict(c: Pick<ListingCard, 'verdict' | 'delta_percent'>): string | null {
  if (!c.verdict || c.delta_percent == null) return null;
  if (c.verdict === 'near') return `Gần trung vị (${c.delta_percent > 0 ? '+' : '−'}${formatPercent(c.delta_percent)})`;
  return `${VERDICT_WORD[c.verdict]} trung vị ${formatPercent(c.delta_percent)}`;
}

function areaBandText(band: string | null): string {
  if (!band) return '';
  const m = band.match(/\[(\d+),(\d+)\)/);
  return m ? `${m[1]}–${m[2]} m²` : band;
}

/** Sentence from docs/02-data/05-gop-trung-va-thong-ke.md §5. */
export function verdictSentence(c: Comparison, rentForm?: Rent['amount_form'], visibility?: Rent['visibility']): string {
  if (c.message) return c.message;
  const type = PROPERTY_LABEL[c.criteria.property_type ?? 'unknown'].toLowerCase();
  const band = areaBandText(c.criteria.area_band);
  const group = `${c.n} tin ${type}${band ? ` ${band}` : ''} cùng phường`;
  if (c.status === 'ok' && c.verdict && c.delta_percent != null) {
    if (c.verdict === 'near') return `Gần trung vị (${c.delta_percent > 0 ? '+' : '−'}${formatPercent(c.delta_percent)}) của ${group}.`;
    return `${VERDICT_WORD[c.verdict]} ${formatPercent(c.delta_percent)} so với trung vị của ${group}.`;
  }
  if (c.reason_codes.includes('price_not_exact') && visibility === 'not_stated') return 'Bài không ghi giá, chưa so sánh được.';
  if (c.reason_codes.includes('price_not_exact')) {
    const form =
      visibility === 'hidden_explicit' ? 'không công khai' : rentForm === 'starting_from' ? '“từ…”' : rentForm === 'range' ? '“khoảng…”' : 'không rõ ràng';
    return `Bài ghi giá dạng ${form}, chưa so sánh được.`;
  }
  if (c.reason_codes.includes('too_few_samples'))
    return `Chưa đủ dữ liệu để nhận định: mới có ${c.n} tin tương tự (cần ít nhất 10).`;
  return 'Chưa so sánh được tin này.';
}

export const REASON_TEXT: Record<ComparisonReason, string> = {
  too_few_samples: 'Nhóm tương tự có ít hơn 10 tin',
  price_not_exact: 'Giá không phải một con số cụ thể',
  basis_unknown: 'Không rõ giá theo phòng hay theo người',
  ward_unresolved: 'Chưa xác định được phường',
  area_missing_broad_group: 'Thiếu diện tích, chỉ so được với nhóm rộng',
};

export function dataRangeSentence(from: string | null, to: string | null): string {
  if (!from || !to) return 'Chưa có khoảng thời gian dữ liệu. Đây là giá chào thuê, không phải giá giao dịch.';
  return `Dữ liệu từ ${formatDate(from)} đến ${formatDate(to)}. Đây là giá chào thuê trong bài đăng đã thu, không phải giá giao dịch.`;
}

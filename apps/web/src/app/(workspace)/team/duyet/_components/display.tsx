import type { Fee, Listing } from '@/lib/api/types';
import { FEE_LABEL, formatVnd } from '@/lib/format';
import styles from './review.module.css';

export const REASON_NAME: Record<string, string> = {
  conflict: 'Các cách đọc chưa khớp', multi_listing: 'Một bài có nhiều tin',
  basis_unknown: 'Chưa rõ cách tính giá', possible_duplicate: 'Có thể trùng tin',
  llm_error: 'Bước LLM gặp lỗi', field_needs_review: 'Trường cần kiểm tra',
};

// Keep short semantic phrases together without preventing a whole paragraph from wrapping.
export function Phrases({ text }: { text: string }) {
  const parts = text.split(/(\d[\d.,]*(?:[–-]\d[\d.,]*)?\s*(?:m²|m2|tr|đ|tháng)(?:\s*tiền thuê)?(?:\/(?:người\/tháng|tháng|ngày|số|khối))?|Cầu Giấy|Yên Hòa|Nghĩa Đô|Hòa Lạc|thang máy|Không đề cập|chưa rõ kỳ|giá thuê|Chưa rõ giá)/giu);
  return <>{parts.map((part, index) => index % 2 ? <span key={index} className={styles.phrase} data-phrase>{part}</span> : part)}</>;
}

export function reviewFeeValue(fee: Fee): string {
  if (fee.free) return 'Miễn phí';
  if (fee.state_rate) return 'Giá nhà nước';
  if (fee.type === 'deposit' && fee.months != null) return fee.months.toLocaleString('vi-VN') + ' tháng tiền thuê';
  if (fee.amount_vnd == null) return 'Có nhắc, không ghi số';
  const units: Record<Fee['unit'], string> = {
    per_kwh: '/số', per_m3: '/khối', per_person_month: '/người/tháng',
    per_unit_month: '/tháng', months_of_rent: '', one_time: ' một lần', unknown: ' · chưa rõ kỳ',
  };
  return formatVnd(fee.amount_vnd) + units[fee.unit];
}

export function feeLabel(fee: Fee) {
  // These names are taken from the field's own evidence, never from another fee.
  const quote = (fee.evidence ?? []).map(span => span.quote).join(' ').toLocaleLowerCase('vi-VN');
  if (fee.type === 'electricity' && quote.includes('điện hành lang')) return 'Điện hành lang';
  if (fee.type === 'service' && quote.includes('vệ sinh')) return 'Vệ sinh';
  return FEE_LABEL[fee.type];
}

export function reviewRent(rent: Listing['rent']): string {
  if (rent.visibility === 'hidden_explicit') return 'Bài không công khai giá';
  const unit = rent.period === 'month' ? '/tháng' : rent.period === 'day' ? '/ngày' : ' · chưa rõ kỳ';
  const basis = rent.basis === 'per_person' ? ' · mỗi người' : rent.basis === 'unknown' ? ' · chưa rõ cách tính' : '';
  const amount = rent.amount_form === 'exact' && rent.amount_vnd != null ? formatVnd(rent.amount_vnd)
    : rent.amount_form === 'starting_from' && rent.min_vnd != null ? 'Từ ' + formatVnd(rent.min_vnd)
    : rent.amount_form === 'range' && rent.min_vnd != null && rent.max_vnd != null ? formatVnd(rent.min_vnd) + ' – ' + formatVnd(rent.max_vnd)
    : null;
  return amount ? amount + unit + basis : 'Không đề cập';
}

export function FeeSummary({ listing }: { listing: Listing }) {
  const fees = listing.fees.filter(fee => fee.type !== 'deposit');
  const deposits = listing.fees.filter(fee => fee.type === 'deposit');
  return <div className={styles.feeSummary}>
    <span><Phrases text="Các khoản phí — tách khỏi giá thuê" /></span>
    {fees.length ? fees.map((fee, index) => <div className={styles.feeRow} key={index}><span>{feeLabel(fee)}</span><strong><Phrases text={reviewFeeValue(fee)} /></strong></div>) : <p>Không đề cập</p>}
    <div className={styles.deposit}><span>Đặt cọc</span>{deposits.length ? deposits.map((fee, index) => <strong key={index}><Phrases text={reviewFeeValue(fee)} /></strong>) : <strong>Không đề cập</strong>}</div>
  </div>;
}

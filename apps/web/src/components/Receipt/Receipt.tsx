import type { ReactNode } from 'react';
import type { Fee } from '@/lib/api/types';
import { formatArea, formatFee, formatRent } from '@/lib/display-format';
import { PhraseText } from '../PhraseText/PhraseText';
import styles from '../shared.module.css';

export type ReceiptData = { rentVnd?: number | null; basis?: 'per_unit' | 'per_person' | 'unknown'; areaM2?: number | null; propertyType?: string | null; amenities?: string[]; location?: string | null; fees?: Fee[]; deposit?: Fee | null };
export function Receipt({ data, title = 'Phiếu đọc bài đăng', children }: { data: ReceiptData; title?: string; children?: ReactNode }) {
  const fees = (data.fees ?? []).filter(fee => fee.type !== 'deposit');
  const value = (value: string | null | undefined) => value || 'Không đề cập';
  const rows = [['Diện tích', formatArea(data.areaM2)], ['Loại phòng', value(data.propertyType)], ['Tiện nghi', data.amenities?.length ? data.amenities.join(' · ') : 'Không đề cập'], ['Vị trí', value(data.location)]];
  const deposits = data.deposit ? [data.deposit] : (data.fees ?? []).filter(fee => fee.type === 'deposit');
  return (
    <section className={styles.receipt} aria-label={title}>
      <header className={styles.receiptHeader}><div><h2>{title}</h2><p className={styles.eyebrow}>Giá, phí và cọc giữ riêng</p></div></header>
      <div className={styles.rent}><span className={styles.rentLabel}>Giá thuê</span><strong className={styles.rentValue}><PhraseText text={formatRent(data.rentVnd, data.basis)} /></strong></div>
      <dl className={styles.facts}>{rows.map(([label, item]) => <div className={styles.fact} key={label}><dt>{label}</dt><dd className={item === 'Không đề cập' ? styles.missing : ''}><PhraseText text={item} /></dd></div>)}</dl>
      <h3 className={styles.sectionTitle}>Các khoản phí</h3>
      {fees.length ? <ul className={styles.feeList}>{fees.map((fee, index) => <li className={styles.fee} key={`${fee.type}-${index}`}><PhraseText text={formatFee(fee)} /></li>)}</ul> : <p className={styles.missing}>Không đề cập</p>}
      <h3 className={styles.sectionTitle}>Đặt cọc</h3>
      {deposits.length ? deposits.map((deposit, index) => <p className={styles.fee} key={index}><PhraseText text={formatFee(deposit)} /></p>) : <p className={styles.missing}>Không đề cập</p>}
      <p className={styles.hint}>Không cộng giá thuê, phí và cọc thành tổng.</p>{children}
    </section>
  );
}

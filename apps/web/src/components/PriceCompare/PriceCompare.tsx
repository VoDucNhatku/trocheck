import { formatDecimal, formatRent } from '@/lib/display-format';
import { PhraseText } from '../PhraseText/PhraseText';
import styles from '../shared.module.css';

export function PriceCompare({ meanVnd, targetVnd, n, basis = 'unknown', verdict, deltaPercent, group = 'cùng nhóm' }: { meanVnd?: number | null; targetVnd?: number | null; n: number; basis?: 'per_unit' | 'per_person' | 'unknown'; verdict?: 'higher' | 'near' | 'lower' | 'insufficient'; deltaPercent?: number | null; group?: string }) {
  const ready = meanVnd != null && Number.isFinite(meanVnd) && n >= 10 && verdict !== 'insufficient';
  const delta = deltaPercent != null && Number.isFinite(deltaPercent) ? ` ${formatDecimal(Math.abs(deltaPercent))}%` : '';
  const message = !ready
    ? n < 10 ? `Chưa đủ dữ liệu để nhận định: mới có ${n} tin tương tự (cần ít nhất 10).` : 'Chưa có giá trung bình hợp lệ để so sánh.'
    : verdict === 'higher' ? `Cao hơn giá trung bình${delta}.`
      : verdict === 'lower' ? `Thấp hơn giá trung bình${delta}.`
        : verdict === 'near' ? 'Gần giá trung bình của nhóm.' : 'Chưa có kết luận so sánh từ hệ thống.';
  return (
    <section className={styles.compare} aria-label="So sánh giá trung bình">
      <header className={styles.compareHeader}><div><h2>So với cùng nhóm</h2><p className={styles.eyebrow}>Dùng giá trung bình của các tin tương tự.</p></div></header>
      <p className={styles.verdict} data-tone={ready ? verdict : 'insufficient'}><PhraseText text={message} /></p>
      {ready && <dl className={styles.numbers}><div><dt>Giá trung bình</dt><dd><PhraseText text={formatRent(meanVnd, basis)} /></dd></div>{targetVnd != null && <div><dt>Tin này</dt><dd><PhraseText text={formatRent(targetVnd, basis)} /></dd></div>}</dl>}
      <p className={styles.hint}><PhraseText text={`${n} tin ${group}. Giá chào thuê trong bài đăng, không phải giá giao dịch.`} /></p>
    </section>
  );
}

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Fee } from '@/lib/api/types';
import { formatArea, formatFee, formatRent } from '@/lib/display-format';
import { PhraseText } from '../PhraseText/PhraseText';
import styles from '../shared.module.css';

export type ListingCardData = { id?: string; title: string; propertyType?: string | null; rentVnd?: number | null; basis?: 'per_unit' | 'per_person' | 'unknown'; areaM2?: number | null; location?: string | null; fees?: Fee[]; imageLabel?: string; href?: string };
export function ListingCard({ data, comparison, children }: { data: ListingCardData; comparison?: ReactNode; children?: ReactNode }) {
  const fees = (data.fees ?? []).filter(fee => fee.type !== 'deposit');
  const deposits = (data.fees ?? []).filter(fee => fee.type === 'deposit');
  return (
    <article className={styles.card}>
      <div className={styles.media}>{data.imageLabel && <span className={styles.tag}>{data.imageLabel}</span>}<span>Ảnh phòng (ví dụ)</span></div>
      <div className={styles.cardContent}>
        <p className={styles.cardMeta}><PhraseText text={data.propertyType ?? 'Không đề cập'} /></p>
        <h2>{data.href ? <Link href={data.href}><PhraseText text={data.title} /></Link> : <PhraseText text={data.title} />}</h2>
        <strong className={styles.cardPrice}><PhraseText text={formatRent(data.rentVnd, data.basis)} /></strong>
        <p className={styles.cardMeta}><PhraseText text={`Diện tích · ${formatArea(data.areaM2)}`} /></p>
        <p className={styles.cardMeta}><PhraseText text={`Vị trí · ${data.location || 'Không đề cập'}`} /></p>
        <div className={styles.tagList}>{fees.slice(0, 3).map((fee, index) => <span className={styles.tag} key={`${fee.type}-${index}`}><PhraseText text={formatFee(fee)} /></span>)}{fees.length > 3 && <span className={styles.tag}>+{fees.length - 3} khoản phí</span>}</div>
        {deposits.map((deposit, index) => <p className={styles.cardMeta} key={index}><PhraseText text={formatFee(deposit)} /></p>)}
        {comparison && <div className={styles.verdict}>{comparison}</div>}{children}
      </div>
    </article>
  );
}

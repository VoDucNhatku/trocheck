'use client';
import Link, { useLinkStatus } from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import type { ListingCard as Card } from '@/lib/api/types';
import { PROPERTY_LABEL, cardVerdict, feeLine, formatDate, rentHeadline } from '@/lib/format';
import styles from './ListingCard.module.css';

export function ListingCard({ card }: { card: Card }) {
  const head = rentHeadline(card.rent);
  const verdict = cardVerdict(card);
  return (
    <Link href={`/tin/${card.listing_id}?demo=${card.is_demo}`} className={styles.card}>
      <div className={styles.top}>
        <span className={styles.type}>{PROPERTY_LABEL[card.property_type]}</span>
        <span className={styles.date}>{card.posted_at ? formatDate(card.posted_at) : 'Chưa rõ ngày đăng'}</span>
      </div>
      <div className={styles.badges}>
        {!card.is_demo ? (
          <span className={styles.real}>Đã che SĐT</span>
        ) : (
          <span className={styles.example}>Ví dụ tự tạo</span>
        )}
        {!card.text_complete && <span className={styles.partial}>Chữ chưa đầy đủ</span>}
      </div>

      <p className={[styles.price, head.missing ? styles.missing : ''].join(' ')}>
        {head.main}
        {head.suffix && <small>{head.suffix}</small>}
      </p>

      <p className={styles.place}>
        <MapPin size={13} aria-hidden="true" />
        <span>
          {card.ward_name ?? 'Chưa rõ phường'}
          {card.landmark ? ` · ${card.landmark}` : ''}
        </span>
      </p>

      <dl className={styles.facts}>
        <div>
          <dt>Diện tích</dt>
          <dd>{card.area_m2 != null ? `${card.area_m2} m²` : 'Chưa rõ'}</dd>
        </div>
        <div className={styles.feeRow}>
          <dt>Phí</dt>
          <dd>{feeLine(card.fees)}</dd>
        </div>
      </dl>

      <div className={styles.foot}>
        {verdict ? (
          <span className={styles.verdict} data-v={card.verdict}>
            {verdict}
          </span>
        ) : (
          <span className={styles.noVerdict}>Chưa có nhận định</span>
        )}
        <OpeningIndicator />
      </div>
    </Link>
  );
}

function OpeningIndicator() {
  const { pending } = useLinkStatus();
  return pending ? <span role="status">Đang mở tin…</span> : <ArrowUpRight size={16} className={styles.arrow} aria-hidden="true" />;
}

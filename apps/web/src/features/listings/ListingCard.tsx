'use client';
import Link, { useLinkStatus } from 'next/link';
import { ArrowUpRight, ImageOff } from 'lucide-react';
import type { ListingCard as Card, Comparison } from '@/lib/api/types';
import { PROPERTY_LABEL, formatDate } from '@/lib/format';
import { AtomicText, Phrase } from '@/features/landing/examples';
import { listingRent, listingFee, FEE_LABEL } from './listing-format';
import styles from './ListingCard.module.css';

export function ListingCard({ card, comparison }: { card: Card; comparison?: Comparison | null }) {
  const head=listingRent(card.rent);
  const fees=card.fees.filter(f=>f.type!=='deposit');
  const deposit=card.fees.find(f=>f.type==='deposit');
  const delta=comparison?.delta_percent;
  // The API owns the near/higher/lower thresholds as well as the displayed message.
  const tone=delta==null?undefined:comparison?.verdict;
  return <Link href={`/tin/${card.listing_id}?demo=${card.is_demo}`} className={styles.card}>
    <div className={styles.media}>
      <span className={styles.badge}>{card.is_demo?'Ví dụ tự tạo':'Đã che liên hệ'}</span>
      <ImageOff size={30} strokeWidth={1.25} aria-hidden="true" />
      <span>{card.is_demo?'Ảnh phòng (ví dụ)':'Tin chưa có ảnh'}</span>
    </div>
    <div className={styles.content}>
      <p className={styles.type}>{PROPERTY_LABEL[card.property_type]}</p>
      <h2 className={styles.place}><AtomicText text={card.ward_name?.trim()||'Chưa rõ phường'} />{card.landmark&&<> · <AtomicText text={card.landmark} /></>}</h2>
      {!card.text_complete&&<span className={styles.partial}>Chữ chưa đầy đủ</span>}
      <p className={`${styles.price} ${head.missing?styles.missing:''}`}><AtomicText text={head.main} />{head.suffix&&<small>{head.suffix}</small>}</p>
      {!head.missing&&card.rent.basis==='unknown'&&<p className={styles.note}>Chưa rõ cách tính giá</p>}
      <p className={styles.area}>Diện tích · {card.area_m2!=null?<Phrase>{card.area_m2.toLocaleString('vi-VN')} m²</Phrase>:'Không đề cập'}</p>
      <div className={styles.fees}>{fees.length?fees.slice(0,3).map((f,i)=><span key={`${f.type}-${i}`}>{FEE_LABEL[f.type]} <AtomicText text={listingFee(f)} /></span>):<span>Phí: Không đề cập</span>}{fees.length>3&&<span>+{fees.length-3} khoản · xem tin</span>}</div>
      <p className={styles.deposit}>Đặt cọc · {deposit?<AtomicText text={listingFee(deposit)} />:'Không đề cập'}</p>
      <div className={styles.verdict} data-v={tone??'none'} data-status={comparison?.status??'unavailable'}>
        <AtomicText text={comparison?.message || 'Chưa tải được nhận định. Mở tin để xem chi tiết.'} />
      </div>
      <div className={styles.foot}><span>{card.posted_at?`Đăng ${formatDate(card.posted_at)}`:'Chưa rõ ngày đăng'}</span><OpeningIndicator /></div>
    </div>
  </Link>;
}
function OpeningIndicator() {
  const {pending}=useLinkStatus();
  return pending?<span role="status">Đang mở tin…</span>:<ArrowUpRight size={16} aria-hidden="true" />;
}

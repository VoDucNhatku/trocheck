'use client';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ImageOff, ArrowUpRight } from 'lucide-react';
import { EvidenceHighlighter, evidenceKey, segment } from '@/components/EvidenceHighlighter/EvidenceHighlighter';
import type { Evidence, ListingDetail } from '@/lib/api/types';
import { formatDate, formatVnd } from '@/lib/format';
import { AtomicText } from '@/features/landing/examples';
import { Receipt } from './Receipt';
import { receiptModel, publicSource } from './receipt-model';
import styles from './DetailBody.module.css';

export function DetailBody({detail,comparison}:{detail:ListingDetail;comparison:ReactNode}) {
  const {listing,post}=detail;
  const model=useMemo(()=>receiptModel(listing,post.text),[listing,post.text]);
  const [active,setActive]=useState<string|null>(null);
  const original=useRef<HTMLElement>(null);
  const selected=active==='rent'?model.rentEvidence:model.rows.find(r=>r.id===active)?.evidence??[];
  // A room span may sit inside a longer price span. Highlight the rendered owner.
  const activeKeys=new Set(segment(post.text,model.evidence).flatMap(part=>part.span&&selected.some(e=>e.start<part.span!.end&&e.end>part.span!.start)?[evidenceKey(part.span)]:[]));
  const select=(id:string)=>{
    setActive(current=>current===id?null:id);
    const box=original.current?.getBoundingClientRect();
    if(box&&(box.top<70||box.top>innerHeight*.6))original.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  };
  const onSpan=(e:Evidence)=>{
    const key=evidenceKey(e);
    if(model.rentEvidence.some(item=>evidenceKey(item)===key))setActive(current=>current==='rent'?null:'rent');
    else {const row=model.rows.find(r=>r.evidence.some(item=>evidenceKey(item)===key));if(row)setActive(current=>current===row.id?null:row.id)}
  };
  const history=detail.price_history.filter(h=>h.rent_form==='exact'&&h.rent_vnd!=null);
  const source=publicSource(post.source_group_name);
  const permalink=post.permalink&&/^https?:\/\//i.test(post.permalink)?post.permalink:null;
  return <div className={styles.grid}>
    <div className={styles.originalColumn}>
      <figure className={styles.figure}><div className={styles.media}><ImageOff size={36} strokeWidth={1.25} aria-hidden="true" /><span>Ảnh phòng (ví dụ)</span></div><figcaption>Khối giữ chỗ. Không hiển thị ảnh phòng thật.</figcaption></figure>
      <section ref={original} className={styles.original} aria-labelledby="evidence-title">
        <header className={styles.originalHead}><h2 id="evidence-title">Bài đăng gốc</h2><span>Người đăng đã ẩn</span></header>
        <p className={styles.hint}>Bấm vào phiếu giá hoặc đoạn được đánh dấu để đối chiếu.</p>
        <EvidenceHighlighter className={styles.evidenceText} text={post.text} evidence={model.evidence} active={activeKeys} onSelect={onSpan} size="lg" />
        <p className={styles.selection} role="status">{active?`Đang đối chiếu: ${active==='rent'?'Giá thuê':model.rows.find(r=>r.id===active)?.label??''}.`:'Chưa chọn trường đối chiếu.'}</p>
        <p className={styles.hint}>{source?`${source} · `:''}Số điện thoại đã che{detail.is_demo?' · Bài ví dụ tự tạo':''}{!post.text_complete?' · Văn bản nguồn chưa đầy đủ':''}.</p>
        {permalink?<a className={styles.sourceLink} href={permalink} target="_blank" rel="noreferrer noopener">Mở bài gốc <ArrowUpRight size={15} aria-hidden="true" /></a>:<p className={styles.hint}>{detail.is_demo?'Bài ví dụ tự tạo không có liên kết Facebook.':'Không có liên kết bài gốc.'}</p>}
      </section>
      {history.length>0&&<section className={styles.history}><h2>Lịch sử giá</h2><ul>{history.map((item,index)=><li key={index}><span>{formatDate(item.observed_at)} ·</span>{' '}<strong><AtomicText text={formatVnd(item.rent_vnd!)} /></strong></li>)}</ul><p className={styles.hint}>Các mức giá được ghi nhận; không suy ra giá cho những lần thiếu số.</p></section>}
    </div>
    <aside className={styles.aside} aria-label="Phiếu giá và so sánh"><Receipt listing={listing} model={model} active={active} onSelect={select} />{comparison}</aside>
  </div>;
}

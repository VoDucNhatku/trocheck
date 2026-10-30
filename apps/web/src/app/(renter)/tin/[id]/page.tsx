import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ArrowLeft, Info } from 'lucide-react';
import { ApiState, LoadingState } from '@/components/ApiState/ApiState';
import { ComparisonPanel } from '@/features/listing-detail/ComparisonPanel';
import { DetailBody } from '@/features/listing-detail/DetailBody';
import { receiptModel, publicSource } from '@/features/listing-detail/receipt-model';
import { AtomicText } from '@/features/landing/examples';
import { parseDemo, type SearchParams } from '@/features/listings/filters';
import { getListing } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/http';
import { PROPERTY_LABEL, formatDate } from '@/lib/format';
import styles from './page.module.css';

type Props={params:Promise<{id:string}>;searchParams:Promise<SearchParams>};
export const dynamic='force-dynamic';
export async function generateMetadata({params,searchParams}:Props):Promise<Metadata> {
  try {const detail=await getListing((await params).id,parseDemo(await searchParams));return {title:detail?PROPERTY_LABEL[detail.listing.room.property_type]:'Không tìm thấy tin'}}
  catch {return {title:'Chi tiết tin'}}
}
export default async function ListingPage({params,searchParams}:Props) {
  const {id}=await params;let detail;
  try {detail=await getListing(id,parseDemo(await searchParams))}
  catch(error){return <div className={`container ${styles.page}`}><ApiState title="Chưa tải được tin" message={errorMessage(error)} /></div>}
  if(!detail)notFound();
  const {listing,post}=detail;
  const model=receiptModel(listing,post.text);
  const area=model.rows.find(r=>r.id==='area')!.value;
  const location=model.rows.find(r=>r.id==='location')!.value;
  const type=model.rows.find(r=>r.id==='room')!.value;
  const source=publicSource(post.source_group_name);
  return <div className={`container ${styles.page}`}>
    <nav aria-label="Đường dẫn"><Link href={`/tim-tro?demo=${detail.is_demo}`} className={styles.back}><ArrowLeft size={16} aria-hidden="true" />Tìm trọ</Link><span className={styles.crumb}> / Chi tiết tin</span></nav>
    <header className={styles.head}>
      <div className={styles.badges}><span>{detail.is_demo?'Ví dụ tự tạo':'Đã che liên hệ'}</span>{!post.text_complete&&<span className={styles.partial}>Chữ chưa đầy đủ</span>}</div>
      <h1 className={styles.title}><AtomicText text={`${type==='Không đề cập'?'Tin cho thuê':type} · ${area==='Không đề cập'?'Diện tích không đề cập':area}`} /></h1>
      <p className={styles.place}><AtomicText text={location==='Không đề cập'?'Vị trí: Không đề cập':location} /></p>
      <p className={styles.meta}>{post.posted_at?`Đăng ${formatDate(post.posted_at)}`:'Chưa rõ ngày đăng'}{source?` · ${source}`:''}</p>
    </header>
    {!post.text_complete&&<p className={styles.notice} role="note"><Info size={18} aria-hidden="true" /><span>Văn bản nguồn chưa đầy đủ. Phần chữ đã thu không nói tới sẽ hiện “Không đề cập”, không đoán.</span></p>}
    <DetailBody detail={detail} comparison={<Suspense fallback={<LoadingState message="Đang tải so sánh…" />}><ComparisonPanel id={id} demo={detail.is_demo} targetRent={model.rentEvidence.length>0&&listing.rent.visibility==='disclosed'&&listing.rent.amount_form==='exact'&&listing.rent.period==='month'?listing.rent.amount_vnd??null:null} /></Suspense>} />
    <p className={styles.note}>Giá chào thuê trong bài đăng, không phải giá giao dịch. Các con số trên phiếu được đối chiếu với chữ gốc; phần bài không ghi được giữ là thiếu.</p>
  </div>;
}

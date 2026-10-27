import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ApiState, LoadingState } from '@/components/ApiState/ApiState';
import { ComparisonPanel } from '@/features/listing-detail/ComparisonPanel';
import { errorMessage } from '@/lib/api/http';
import { parseDemo, type SearchParams } from '@/features/listings/filters';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Info } from 'lucide-react';
import { DetailBody } from '@/features/listing-detail/DetailBody';
import { getListing } from '@/lib/api/client';
import { PROPERTY_LABEL, formatDate } from '@/lib/format';
import styles from './page.module.css';

type Params = Promise<{ id: string }>;

export const dynamic = 'force-dynamic';
type Props = { params: Params; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  let detail;
  try {
    detail = await getListing((await params).id, parseDemo(await searchParams));
  } catch { return { title: 'Chi tiết tin' }; }
  if (!detail) notFound();
  return { title: PROPERTY_LABEL[detail.listing.room.property_type] };
}

export default async function ListingPage({ params, searchParams }: Props) {
  const { id } = await params;
  let detail;
  try { detail = await getListing(id, parseDemo(await searchParams)); }
  catch (error) { return <div className={`container ${styles.page}`}><ApiState title="Chưa tải được tin" message={errorMessage(error)} /></div>; }
  if (!detail) notFound();

  const { listing, post } = detail;
  const loc = listing.location;
  const place = [loc.landmark, loc.street, loc.ward_name, loc.old_ward_name, loc.old_district_name].filter(Boolean).join(' · ');

  return (
    <div className={`container ${styles.page}`}>
      <Link href={`/tim-tro?demo=${detail.is_demo}`} className={styles.back}>
        <ArrowLeft size={14} aria-hidden="true" /> Về danh sách
      </Link>

      <header className={styles.head}>
        <div className={styles.badges}>
          {!detail.is_demo ? (
            <span className={styles.real}>Đã che SĐT</span>
          ) : (
            <span className={styles.example}>Ví dụ tự tạo</span>
          )}
          {!post.text_complete && <span className={styles.partial}>Chữ chưa đầy đủ</span>}
        </div>
        <h1 className={styles.title}>
          {PROPERTY_LABEL[listing.room.property_type]}
          {listing.area.value_m2 != null ? `, ${listing.area.value_m2} m²` : ''}
        </h1>
        <p className={styles.meta}>
          <span>{place || 'Chưa rõ vị trí'}</span>
          <span>{post.posted_at ? `Đăng ${formatDate(post.posted_at)}` : 'Chưa rõ ngày đăng'}</span>
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noreferrer noopener">
              Bài gốc <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          )}
        </p>
      </header>

      {!post.text_complete && (
        <p className={styles.notice} role="note">
          <Info size={15} aria-hidden="true" />
          Văn bản nguồn chưa đầy đủ; phần nội dung đã thu có thể bị cắt. Những gì phần chữ đã thu không nói tới sẽ hiện là
          “Chưa rõ” hoặc “Không đề cập”, không đoán.
        </p>
      )}

      <DetailBody detail={detail} />

      <section className={styles.compare} aria-labelledby="compare-title">
        <h2 id="compare-title" className={styles.h2}>
          So sánh
        </h2>
        <Suspense fallback={<LoadingState message="Đang tải so sánh…" />}>
          <ComparisonPanel id={id} demo={detail.is_demo} targetRent={listing.rent.amount_vnd ?? null} />
        </Suspense>
      </section>
    </div>
  );
}

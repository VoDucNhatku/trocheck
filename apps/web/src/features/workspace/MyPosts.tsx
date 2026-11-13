'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, messageOf } from '@/lib/workspace/client';
import { formatVnd, PROPERTY_LABEL } from '@/lib/format';
import { AtomicText } from '@/features/landing/examples';
import { Button, Empty, ErrorNotice, Intro, Loading, s } from './ui';
import { PersonalNav } from './PersonalNav';
import { comparisonText, GROUP_LABEL, safeOriginalLink, STATUS_LABEL, statusExplanation,
  type ExtractedListing, type MyPostsData, type MyPostsSummary, type StatusGroup } from './my-posts-model';
import a from './account-notices.module.css';
import styles from './my-posts.module.css';

function price(listing: ExtractedListing) {
  if (listing.price_vnd == null && listing.price_min_vnd == null) return 'Chưa rõ giá';
  const amount = listing.price_vnd ?? listing.price_min_vnd!;
  const prefix = listing.price_form === 'starting_from' ? 'Từ ' : listing.price_form === 'range' ? 'Khoảng từ ' : '';
  const period = listing.price_period === 'month' ? '/tháng' : listing.price_period === 'day' ? '/ngày' : ' · chưa rõ kỳ';
  const basis = listing.price_basis === 'per_person' ? '/người' : '';
  return prefix + formatVnd(amount) + period + basis;
}

export function MyPostsEmpty({ filtered = false }: { filtered?: boolean }) {
  return <Empty title={filtered ? 'Chưa có bài ở trạng thái này' : 'Bạn chưa gửi bài nào'}>
    <p>{filtered ? 'Chọn trạng thái khác để xem các bài đã gửi.' : 'Cài tiện ích, kết nối tài khoản rồi gửi bài từ nhóm Facebook bạn đang đọc.'}</p>
    <div className={styles.emptyActions}><Link className={s.textLink} href="/extension">Cài tiện ích</Link><Link className={s.textLink} href="/tai-khoan">Kết nối tài khoản</Link></div>
  </Empty>;
}

export function MyPosts() {
  const [group, setGroup] = useState<StatusGroup>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MyPostsData | null>(null);
  const [summary, setSummary] = useState<MyPostsSummary | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('');
    Promise.all([
      api<MyPostsData>(`me/posts?group=${group}&page=${page}&limit=20`, { signal: controller.signal }),
      api<MyPostsSummary>('me/posts/summary', { signal: controller.signal }),
    ]).then(([posts, totals]) => { if (!controller.signal.aborted) { setData(posts); setSummary(totals); } })
      .catch(caught => { if (!controller.signal.aborted) setError(messageOf(caught)); });
    return () => controller.abort();
  }, [group, page, reload]);

  return <div className={styles.page}>
    <Intro title="Bài của tôi" description="Theo dõi bài bạn đã gửi bằng tiện ích và thông tin máy chủ đã đọc được."><PersonalNav current="posts" /></Intro>
    {summary && <div className={styles.summary} aria-label="Tổng quan bài đã gửi">
      <p className={styles.quota}>Hôm nay đã gửi <strong>{summary.quota.used}{summary.quota.limit == null ? ' bài · không giới hạn' : `/${summary.quota.limit} bài`}</strong></p>
      <p className={s.muted}>{summary.quota.remaining == null ? 'Tài khoản không áp dụng giới hạn gửi bài mỗi ngày.' : `Còn ${summary.quota.remaining} bài mới trong ngày, tính theo giờ Việt Nam.`} Bài gửi trùng không dùng thêm lượt.</p>
    </div>}
    <p className={styles.note}>Bài đang chờ duyệt chỉ hiển thị với người gửi trong trang này. So sánh dùng tin thật đã được chấp nhận, không dùng dữ liệu demo; đây là giá chào thuê.</p>
    <div className={a.filters} role="group" aria-label="Lọc trạng thái bài">
      {(Object.keys(GROUP_LABEL) as StatusGroup[]).map(value => <button key={value} type="button" aria-pressed={value === group}
        onClick={() => { setGroup(value); setPage(1); }}>{GROUP_LABEL[value]}{summary && <span> · {summary.counts[value]}</span>}</button>)}
    </div>
    <div aria-live="polite" aria-busy={!data && !error}>
      {error ? <ErrorNotice message={error} retry={() => setReload(reload + 1)} /> : !data ? <Loading label="Đang tải bài đã gửi…" /> : !data.items.length ? <MyPostsEmpty filtered={group !== 'all'} /> : <>
        <p className={styles.total}>{data.total} bài{group === 'all' ? ' đã gửi' : ' ở trạng thái đã chọn'}</p>
        <div className={styles.cards}>{data.items.map(post => {
          const original = safeOriginalLink(post.permalink);
          return <article key={post.post_id} className={styles.card}>
            <header className={styles.cardHead}><div><h2><AtomicText text={post.source_group_name || 'Bài gửi trực tiếp'} /></h2><p className={s.muted}>Đã nhận <time dateTime={post.received_at}>{new Date(post.received_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</time> · <span className={styles.phrase}>{post.photo_count} ảnh đã tải lên</span></p></div><span className={styles.badge} data-status={post.status}>{STATUS_LABEL[post.status]}</span></header>
            <p className={styles.excerpt}><AtomicText text={post.excerpt || 'Bài chưa có nội dung để hiển thị.'} /></p>
            <p className={styles.explanation}><AtomicText text={statusExplanation(post)} /></p>
            {post.listings.map((lst, index) => <section className={styles.extracted} key={lst.listing_id} aria-label={`Thông tin trích xuất ${index + 1}`}>
              {post.listings.length > 1 && <h3>Tin {index + 1}</h3>}
              <dl className={styles.facts}>
                <div><dt>Giá đã đọc{lst.price_basis === 'per_unit' ? ' · theo phòng' : lst.price_basis === 'per_person' ? ' · theo người' : ''}</dt><dd><span className={styles.phrase}>{price(lst)}</span></dd></div>
                <div><dt>Diện tích</dt><dd className={styles.phrase}>{lst.area_m2 == null ? 'Chưa rõ diện tích' : `${lst.area_m2.toLocaleString('vi-VN')} m²`}</dd></div>
                <div><dt>Loại phòng</dt><dd><AtomicText text={PROPERTY_LABEL[lst.room_type as keyof typeof PROPERTY_LABEL] || 'Chưa rõ loại phòng'} /></dd></div>
                <div><dt>Phường</dt><dd><AtomicText text={lst.ward_name || 'Chưa rõ phường'} /></dd></div>
              </dl>
              <p className={styles.comparison}><AtomicText text={comparisonText(lst.comparison)} /></p>
              {lst.comparison.status !== 'ok' && <p className={s.muted}><AtomicText text={lst.comparison.status === 'insufficient_data' ? lst.comparison.message : 'Cần giá theo tháng, cách tính giá, loại phòng và phường rõ ràng để đối chiếu.'} /></p>}
              {lst.public_url && <Link className={s.textLink} href={lst.public_url}>Xem tin công khai{post.listings.length > 1 ? ` ${index + 1}` : ''}</Link>}
            </section>)}
            {original && <a className={s.textLink} href={original} target="_blank" rel="noopener noreferrer">Xem bài gốc</a>}
          </article>;
        })}</div>
        {data.total > data.limit && <nav className={styles.pager} aria-label="Phân trang bài đã gửi"><Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</Button><span>Trang {page}/{Math.ceil(data.total / data.limit)}</span><Button variant="secondary" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Trang sau</Button></nav>}
      </>}
    </div>
  </div>;
}

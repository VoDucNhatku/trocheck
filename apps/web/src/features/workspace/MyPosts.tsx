'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, messageOf } from '@/lib/workspace/client';
import { formatVnd, PROPERTY_LABEL } from '@/lib/format';
import { AtomicText } from '@/features/landing/examples';
import { Button, Empty, ErrorNotice, Intro, Loading, s } from './ui';
import { PersonalNav } from './PersonalNav';
import { OnboardingChecklist } from './Onboarding';
import { MyPostsFilterBar } from './MyPostsFilterBar';
import { comparisonScopeNote } from './comparison-scope';
import { activeFilterCount, areaMatchLabel, comparisonText, DEFAULT_QUERY, GROUP_LABEL, hasAnyFilter, myPostsApiQuery, myPostsUrlQuery,
  parseMyPostsQuery, placeText, resultPhrases, safeOriginalLink, STATUS_LABEL, statusExplanation, wideningAdvice,
  type ExtractedListing, type MyPostsData, type MyPostsFilters, type MyPostsQuery, type MyPostsSummary, type StatusGroup } from './my-posts-model';
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

export function NoMatch({ query, onClear, onGroup }: { query: MyPostsQuery; onClear: () => void; onGroup: (group: StatusGroup) => void }) {
  const advice = wideningAdvice(query);
  return <Empty title="Không có phòng nào khớp bộ lọc">
    <p>Bạn đã gửi bài, nhưng không phòng nào thỏa tất cả điều kiện đang chọn. Thử nới điều kiện:</p>
    <ul className={styles.advice}>{advice.map(line => <li key={line}><AtomicText text={line} /></li>)}</ul>
    <div className={styles.emptyActions}>
      <Button variant="secondary" onClick={onClear}>Xóa lọc</Button>
      {query.group !== 'all' && <Button variant="secondary" onClick={() => onGroup('all')}>Xem tất cả trạng thái</Button>}
    </div>
  </Empty>;
}

/** The URL is the source of truth: read once on mount and on back/forward, write with replaceState. */
function useUrlQuery(): [MyPostsQuery | null, (next: MyPostsQuery) => void] {
  const [query, setQuery] = useState<MyPostsQuery | null>(null);
  useEffect(() => {
    const read = () => setQuery(parseMyPostsQuery(window.location.search));
    read(); window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);
  const update = useCallback((next: MyPostsQuery) => {
    const text = myPostsUrlQuery(next);
    window.history.replaceState(window.history.state, '', window.location.pathname + (text ? '?' + text : ''));
    setQuery(next);
  }, []);
  return [query, update];
}

export function MyPosts() {
  const [query, setQuery] = useUrlQuery();
  const [data, setData] = useState<MyPostsData | null>(null);
  const [summary, setSummary] = useState<MyPostsSummary | null>(null);
  const [options, setOptions] = useState<MyPostsFilters | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const key = query ? myPostsApiQuery(query) : '';
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController(); setData(null); setError('');
    Promise.all([
      api<MyPostsData>('me/posts?' + key, { signal: controller.signal }),
      api<MyPostsSummary>('me/posts/summary', { signal: controller.signal }),
    ]).then(([posts, totals]) => { if (!controller.signal.aborted) { setData(posts); setSummary(totals); } })
      .catch(caught => { if (!controller.signal.aborted) setError(messageOf(caught)); });
    return () => controller.abort();
  }, [key, reload]);
  useEffect(() => {
    // Filter options are a convenience: the list still works when they fail to load.
    const controller = new AbortController();
    api<MyPostsFilters>('me/posts/filters', { signal: controller.signal })
      .then(next => { if (!controller.signal.aborted && Array.isArray(next?.areas)) setOptions(next); }).catch(() => undefined);
    return () => controller.abort();
  }, [reload]);
  const group = query?.group ?? 'all', page = query?.page ?? 1;
  const clear = () => setQuery({ ...DEFAULT_QUERY, group });
  const narrowed = query ? activeFilterCount(query) > 0 : false;

  return <div className={styles.page}>
    <Intro title="Bài của tôi" description="Theo dõi bài bạn đã gửi bằng tiện ích và thông tin máy chủ đã đọc được."><PersonalNav current="posts" /></Intro>
    {summary && <div className={styles.summary} aria-label="Tổng quan bài đã gửi">
      <p className={styles.quota}>Hôm nay đã gửi <strong>{summary.quota.used}{summary.quota.limit == null ? ' bài · không giới hạn' : `/${summary.quota.limit} bài`}</strong></p>
      <p className={s.muted}>{summary.quota.remaining == null ? 'Tài khoản không áp dụng giới hạn gửi bài mỗi ngày.' : `Còn ${summary.quota.remaining} bài mới trong ngày, tính theo giờ Việt Nam.`} Bài gửi trùng không dùng thêm lượt.</p>
    </div>}
    <OnboardingChecklist summary={summary} />
    <p className={styles.note}>Bài đang chờ duyệt chỉ hiển thị với người gửi trong trang này. So sánh dùng tin thật đã được chấp nhận, không dùng dữ liệu demo; đây là giá chào thuê.</p>
    <div className={a.filters} role="group" aria-label="Lọc trạng thái bài">
      {(Object.keys(GROUP_LABEL) as StatusGroup[]).map(value => <button key={value} type="button" aria-pressed={value === group}
        onClick={() => query && setQuery({ ...query, group: value, page: 1 })}>{GROUP_LABEL[value]}{summary && <span> · {summary.counts[value]}</span>}</button>)}
    </div>
    {query && <MyPostsFilterBar query={query} options={options} busy={!data && !error} onApply={setQuery} onClear={clear} />}
    <div aria-live="polite" aria-busy={!data && !error}>
      {error ? <><ErrorNotice message={error} retry={() => setReload(reload + 1)} />{query && hasAnyFilter(query) && <Button variant="secondary" onClick={clear}>Xóa lọc</Button>}</>
        : !data || !query ? <Loading label="Đang tải bài đã gửi…" />
        : !data.items.length ? (data.total_sent > 0 && (hasAnyFilter(query) || group === 'all') ? <NoMatch query={query} onClear={clear} onGroup={next => setQuery({ ...query, group: next, page: 1 })} /> : <MyPostsEmpty filtered={group !== 'all'} />) : <>
        {narrowed ? <p className={styles.total}>{(([found, sent]) => <><span className={styles.phrase}>{found}</span> trong <span className={styles.phrase}>{sent}</span></>)(resultPhrases(data))}</p>
          : <p className={styles.total}>{data.total} bài{group === 'all' ? ' đã gửi' : ' ở trạng thái đã chọn'}</p>}
        <div className={styles.cards}>{data.items.map(post => {
          const original = safeOriginalLink(post.permalink);
          return <article key={post.post_id} className={styles.card}>
            <header className={styles.cardHead}><div><h2><AtomicText text={post.source_group_name || 'Bài gửi trực tiếp'} /></h2><p className={s.muted}>Đã nhận <time dateTime={post.received_at}>{new Date(post.received_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</time> · <span className={styles.phrase}>{post.photo_count} ảnh đã tải lên</span></p></div><span className={styles.badge} data-status={post.status}>{STATUS_LABEL[post.status]}</span></header>
            <p className={styles.excerpt}><AtomicText text={post.excerpt || 'Bài chưa có nội dung để hiển thị.'} /></p>
            <p className={styles.explanation}><AtomicText text={statusExplanation(post)} /></p>
            {post.listing_total > post.listings.length && <p className={styles.partial}>Bài có <span className={styles.phrase}>{post.listing_total} tin</span>, đang hiện <span className={styles.phrase}>{post.listings.length} tin khớp</span> bộ lọc.</p>}
            {post.listings.map((lst, index) => <section className={styles.extracted} key={lst.listing_id} aria-label={`Thông tin trích xuất ${index + 1}`}>
              {post.listings.length > 1 && <h3>Tin {index + 1}</h3>}
              <dl className={styles.facts}>
                <div><dt>Giá đã đọc{lst.price_basis === 'per_unit' ? ' · theo phòng' : lst.price_basis === 'per_person' ? ' · theo người' : ''}</dt><dd><span className={styles.phrase}>{price(lst)}</span></dd></div>
                <div><dt>Diện tích</dt><dd className={styles.phrase}>{lst.area_m2 == null ? 'Chưa rõ diện tích' : `${lst.area_m2.toLocaleString('vi-VN')} m²`}</dd></div>
                <div><dt>Loại phòng</dt><dd><AtomicText text={PROPERTY_LABEL[lst.room_type as keyof typeof PROPERTY_LABEL] || 'Chưa rõ loại phòng'} /></dd></div>
                <div><dt>Vị trí</dt><dd><span><AtomicText text={placeText(lst)} /></span>{areaMatchLabel(lst.area_match) && <span className={styles.match} data-match={lst.area_match}>{areaMatchLabel(lst.area_match)}</span>}</dd></div>
              </dl>
              <p className={styles.comparison}><AtomicText text={comparisonText(lst.comparison)} /></p>
              {comparisonScopeNote(lst.comparison) && <p className={styles.scope} data-scope={lst.comparison.scope} data-pool={lst.comparison.pool}><AtomicText text={comparisonScopeNote(lst.comparison)!} /></p>}
              {lst.comparison.status !== 'ok' && <p className={s.muted}><AtomicText text={lst.comparison.status === 'insufficient_data' ? lst.comparison.message : 'Cần giá theo tháng, cách tính giá, loại phòng và phường rõ ràng để đối chiếu.'} /></p>}
              {lst.public_url && <Link className={s.textLink} href={lst.public_url}>Xem tin công khai{post.listings.length > 1 ? ` ${index + 1}` : ''}</Link>}
            </section>)}
            {original && <a className={s.textLink} href={original} target="_blank" rel="noopener noreferrer">Xem bài gốc</a>}
          </article>;
        })}</div>
        {data.total > data.limit && <nav className={styles.pager} aria-label="Phân trang bài đã gửi"><Button variant="secondary" disabled={page === 1} onClick={() => query && setQuery({ ...query, page: page - 1 })}>Trang trước</Button><span>Trang {page}/{Math.ceil(data.total / data.limit)}</span><Button variant="secondary" disabled={page * data.limit >= data.total} onClick={() => query && setQuery({ ...query, page: page + 1 })}>Trang sau</Button></nav>}
      </>}
    </div>
  </div>;
}

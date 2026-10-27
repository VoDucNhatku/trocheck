'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, messageOf, workspaceFetch } from '@/lib/workspace/client';
import { hasRole, type SessionUser, type TeamPosts, type ReviewQueue } from '@/lib/workspace/types';
import { formatDate, PROPERTY_LABEL } from '@/lib/format';
import { Button, DataBadge, Empty, ErrorNotice, Intro, Loading, s } from './ui';

export const REASON_NAME: Record<string, string> = { conflict: 'Các cách đọc chưa khớp', multi_listing: 'Một bài có nhiều tin', basis_unknown: 'Chưa rõ giá theo người / phòng', possible_duplicate: 'Có thể trùng tin', llm_error: 'Bước LLM gặp lỗi', field_needs_review: 'Trường cần kiểm tra' };
const POST_STATUS: Record<string, string> = { received: 'Đã tiếp nhận', processing: 'Đang xử lý', processed: 'Đã xử lý', extracted: 'Đã trích xuất', failed: 'Xử lý lỗi', classified: 'Đã phân loại', rejected: 'Đã loại' };
const POST_TYPE: Record<string, string> = { rental_offer: 'Cho thuê', seeking: 'Tìm phòng', roommate: 'Tìm người ở ghép', sale: 'Mua bán', spam: 'Spam', other: 'Khác' };
const JOB_STATUS: Record<string, string> = { queued: 'Đang chờ', running: 'Đang xử lý', succeeded: 'Đã xong', failed: 'Thất bại' };
const PAGE_SIZE = 20;
function Pager({ page, total, path, query }: { page: number; total: number; path: string; query: string }) {
  const target = (next: number) => { const params = new URLSearchParams(query); params.set('page', String(next)); return path + '?' + params.toString(); };
  return <div className={[s.between, s.section].join(' ')}><p className={s.muted}>{total.toLocaleString('vi-VN')} mục · Trang {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}</p><nav className={s.row} aria-label="Phân trang">{page > 1 && <Link prefetch={false} className={[s.button, s.secondary].join(' ')} href={target(page - 1)}>Trang trước</Link>}{page * PAGE_SIZE < total && <Link prefetch={false} className={[s.button, s.secondary].join(' ')} href={target(page + 1)}>Trang sau</Link>}</nav></div>;
}
export function Store({ user, query }: { user: SessionUser; query: string }) {
  const params = new URLSearchParams(query);
  const page = Number(params.get('page')) || 1;
  const [data, setData] = useState<TeamPosts | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState('');
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setData(null);
    api<TeamPosts>('team/posts?' + query + '&page_size=' + PAGE_SIZE, { signal: controller.signal }).then(setData).catch(caught => { if (!controller.signal.aborted) setError(messageOf(caught)); });
    return () => controller.abort();
  }, [query, reload]);
  async function reprocess(id: string) {
    if (lock.current) return; lock.current = true; setBusy(id); setActionError(''); setFeedback('');
    try { const value = await api<{ job_id: string; status: string }>('team/posts/' + id + '/reprocess', { method: 'POST', body: '{}' }); setFeedback('Đã đưa bài vào hàng xử lý: ' + (JOB_STATUS[value.status] ?? value.status) + '.'); setReload(value => value + 1); }
    catch (caught) { setActionError(messageOf(caught)); } finally { lock.current = false; setBusy(''); }
  }
  async function exportData(format: 'csv' | 'json') {
    if (lock.current) return; lock.current = true; setBusy('export'); setActionError('');
    try {
      const response = await workspaceFetch('team/export?format=' + format + '&include_demo=false');
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'rener-listings.' + format; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback('Đã xuất kho thật; không bao gồm bài demo hoặc văn bản gốc.');
    } catch (caught) { setActionError(messageOf(caught)); } finally { lock.current = false; setBusy(''); }
  }
  return <><Intro eyebrow="Không gian nhóm" title="Kho dữ liệu bài đăng" description="Theo dõi bài đã thu, nội dung đầy đủ đến đâu và lần xử lý gần nhất. Kho có thể chứa cả demo và bài thật, từng hàng luôn ghi rõ bộ dữ liệu.">
    {hasRole(user, 'researcher') && <div className={s.row}><Button variant="secondary" disabled={!!busy} onClick={() => exportData('csv')}>Xuất CSV kho thật</Button><Button variant="ghost" disabled={!!busy} onClick={() => exportData('json')}>JSON</Button></div>}</Intro>
    {data && <p className={s.dataHeadline}><strong>{data.total.toLocaleString('vi-VN')}</strong> bài trong lựa chọn hiện tại <span>· Mỗi bài giữ nguồn và trạng thái xử lý riêng</span></p>}
    <form action="/team/kho" className={s.filters}><label className={s.field}><span className={s.label}>Trạng thái bài</span><select className={s.select} name="status" defaultValue={params.get('status') ?? ''}><option value="">Tất cả</option>{Array.from(new Set([...Object.keys(data?.by_status ?? {}), ...(params.get('status') ? [params.get('status')!] : [])])).map(status => <option key={status} value={status}>{POST_STATUS[status] ?? status}</option>)}</select></label>
      <label className={s.field}><span className={s.label}>Nguồn nhóm (tên hoặc ID)</span><input className={s.input} name="group" defaultValue={params.get('group') ?? ''} /></label>
      <label className={s.field}><span className={s.label}>Người thu thập</span><input className={s.input} name="collector" defaultValue={params.get('collector') ?? ''} /></label>
      <label className={s.field}><span className={s.label}>Loại bài</span><select className={s.select} name="post_type" defaultValue={params.get('post_type') ?? ''}><option value="">Tất cả</option>{Object.entries(POST_TYPE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Button type="submit">Lọc kho</Button>
    </form>
    {actionError && <ErrorNotice message={actionError} />}<p className={s.notice} role="status" hidden={!feedback}>{feedback}</p>
    {error ? <ErrorNotice message={error} retry={() => setReload(reload + 1)} /> : !data ? <Loading /> : !data.items.length ? <Empty title={['status', 'group', 'collector', 'post_type'].some(key => params.get(key)) ? 'Chưa có bài khớp bộ lọc' : 'Kho chưa có bài đăng'}><p>Thử bỏ bớt điều kiện. Bạn có thể dùng extension khi bản cài đặt sẵn sàng hoặc phân tích một bài và chủ động đóng góp.</p><Link href="/team/kho" className={s.textLink}>Bỏ bộ lọc</Link></Empty> : <>
      <section className={s.ledger}><div className={s.tableWrap} tabIndex={0} role="region" aria-label="Kho bài đăng, cuộn ngang để xem đủ cột"><table role="table" className={[s.table, s.cardTable].join(' ')}><thead><tr><th>Bài đã thu</th><th>Nguồn / thời điểm</th><th>Loại / trạng thái</th><th>Xử lý</th><th>Thao tác</th></tr></thead><tbody>{data.items.map(post => <tr key={post.post_id}>
        <td data-label="Bài đã thu"><p>{post.excerpt}</p><div className={s.row} style={{ marginTop: 10 }}><DataBadge demo={post.is_demo} />{!post.text_complete && <span className={s.badge}>Nội dung chưa đủ</span>}</div><span className={s.muted}>{post.listing_count} tin · {post.contributed ? 'Đã đóng góp' : 'Chưa đóng góp'}</span></td>
        <td data-label="Nguồn / thời điểm">{post.source_group_name ?? (post.source_type === 'fixture' ? 'Bài tự tạo' : 'Dán thủ công')}<p className={s.hint}>Đăng: {formatDate(post.posted_at)}<br />Thu: {formatDate(post.first_seen_at)}<br />{post.collector}</p></td>
        <td data-label="Loại / trạng thái">{POST_TYPE[post.post_type ?? ''] ?? 'Chưa phân loại'}<br /><span className={s.muted}>{POST_STATUS[post.status] ?? post.status}</span></td>
        <td data-label="Xử lý">{post.job ? <><span className={s.status}>{JOB_STATUS[post.job.status] ?? post.job.status}</span><p className={s.hint}>Lần thử {post.job.attempt}{post.job.error_code ? ' · ' + post.job.error_code : ''}</p></> : <span className={s.muted}>Chưa có job</span>}</td>
        <td data-label="Thao tác"><div className={s.stack} style={{ gap: 6 }}>{(post.collector === user.username || hasRole(user, 'reviewer', 'researcher')) && <Link prefetch={false} className={s.textLink} href={'/phan-tich/' + post.post_id}>Đọc bài</Link>}
          {hasRole(user, 'reviewer') && <Button variant="ghost" disabled={!!busy} busy={busy === post.post_id} onClick={() => reprocess(post.post_id)}>Xử lý lại</Button>}</div></td>
      </tr>)}</tbody></table></div></section><Pager page={page} total={data.total} path="/team/kho" query={query} /></>}
  </>;
}
export function Queue({ query }: { query: string }) {
  const params = new URLSearchParams(query); const page = Number(params.get('page')) || 1;
  const [data, setData] = useState<ReviewQueue | null>(null);
  const [error, setError] = useState(''); const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('');
    api<ReviewQueue>('team/reviews?' + query + '&page_size=' + PAGE_SIZE, { signal: controller.signal }).then(setData).catch(caught => { if (!controller.signal.aborted) setError(messageOf(caught)); }); return () => controller.abort();
  }, [query, reload]);
  return <><Intro title="Những tin cần một lượt đọc" eyebrow="Không gian nhóm / Hàng duyệt" description="Xem lý do trước, đối chiếu bài gốc rồi mới chọn giá trị. Mỗi quyết định được lưu cùng phiên bản và người duyệt." />
    {data && <p className={s.dataHeadline}><strong>{data.total.toLocaleString('vi-VN')}</strong> tin còn cần duyệt <span>· Theo bộ lọc hiện tại</span></p>}
    <form className={s.filters} action="/team/duyet"><label className={s.field}><span className={s.label}>Lý do cần duyệt</span><select className={s.select} name="reason" defaultValue={params.get('reason') ?? ''}><option value="">Tất cả lý do</option>{Object.entries(REASON_NAME).map(([reason, label]) => <option key={reason} value={reason}>{label}{data?.counts[reason] ? ' (' + data.counts[reason] + ')' : ''}</option>)}</select></label><Button type="submit">Lọc hàng duyệt</Button></form>
    {error ? <ErrorNotice message={error} retry={() => setReload(reload + 1)} /> : !data ? <Loading /> : !data.items.length ? <Empty title={params.get('reason') ? 'Không có tin đang chờ ở lựa chọn này' : 'Hàng duyệt đang trống'}><p>Hàng duyệt chỉ hiển thị các tin còn cần xử lý, không dựng việc khi kho đang yên.</p><Link href="/team/duyet" className={s.textLink}>Xem tất cả lý do</Link></Empty> :
      <><section className={s.ledger}><div className={s.tableWrap} tabIndex={0} role="region" aria-label="Hàng duyệt, cuộn ngang để xem đủ cột"><table role="table" className={[s.table, s.cardTable].join(' ')}><thead><tr><th>Lý do cần xem</th><th>Nội dung / ngữ cảnh</th><th>Ngày / bộ dữ liệu</th><th>Thao tác</th></tr></thead><tbody>{data.items.map(item => <tr key={item.listing_id}><td data-label="Lý do cần xem">{(item.reasons.length ? item.reasons : ['field_needs_review']).map(reason => <p key={reason} style={{ marginBottom: 6 }}>{REASON_NAME[reason] ?? 'Trường cần kiểm tra'}</p>)}</td><td data-label="Nội dung / ngữ cảnh"><p>{item.excerpt}</p><span className={s.muted}>{PROPERTY_LABEL[item.property_type]} · {item.ward_name ?? 'Chưa rõ phường'}</span></td><td data-label="Ngày / bộ dữ liệu">{formatDate(item.created_at)}<br /><DataBadge demo={item.is_demo} /></td><td data-label="Thao tác"><Link prefetch={false} className={s.textLink} href={'/team/duyet/' + item.listing_id}>Mở để duyệt</Link><p className={s.hint}>Phiên bản {item.version}</p></td></tr>)}</tbody></table></div></section><Pager page={page} total={data.total} path="/team/duyet" query={query} /></>}
  </>;
}

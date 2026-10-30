'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, messageOf, WorkspaceError } from '@/lib/workspace/client';
import { hasRole, type SessionUser, type TeamPosts } from '@/lib/workspace/types';
import { formatDate } from '@/lib/format';
import { Button, DataBadge, Empty, ErrorNotice, Intro, Loading, Modal, s } from '@/features/workspace/ui';
import { ExportData } from '../../_components/ExportData';
import { Phrases } from '../../duyet/_components/display';
import { storeQuery } from './store-model';
import styles from './store.module.css';

const POST_STATUS: Record<string, string> = { received: 'Đã tiếp nhận', extracted: 'Đã trích xuất', rejected_type: 'Đã loại theo loại bài', failed: 'Xử lý lỗi' };
const POST_TYPE: Record<string, string> = { rental_offer: 'Cho thuê', seeking: 'Tìm phòng', roommate: 'Tìm người ở ghép', sale: 'Mua bán', spam: 'Spam', other: 'Khác' };
const JOB_STATUS: Record<string, string> = { queued: 'Đang chờ', running: 'Đang xử lý', succeeded: 'Đã xong', failed: 'Thất bại' };
const SOURCE: Record<string, string> = { fixture: 'Bài tự tạo', manual_paste: 'Dán thủ công', facebook: 'Facebook', extension: 'Extension' };

export function Store({ user, query }: { user: SessionUser; query: string }) {
  const params = new URLSearchParams(query);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [data, setData] = useState<TeamPosts | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [confirm, setConfirm] = useState<TeamPosts['items'][number] | null>(null);
  const lock = useRef(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (!confirm) trigger.current?.focus(); }, [confirm]);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setData(null);
    api<TeamPosts>('team/posts?' + storeQuery(query), { signal: controller.signal }).then(setData).catch(caught => {
      if (controller.signal.aborted) return;
      if (caught instanceof WorkspaceError && caught.status === 403) window.location.replace('/team/403');
      else setError(messageOf(caught));
    });
    return () => controller.abort();
  }, [query, reload]);
  function close() { if (!lock.current) setConfirm(null); }
  async function reprocess() {
    if (!confirm || lock.current) return;
    lock.current = true; setBusy(true); setActionError(''); setFeedback('');
    try {
      const value = await api<{ post_id: string; job_id: string; status: string }>('team/posts/' + encodeURIComponent(confirm.post_id) + '/reprocess', { method: 'POST' });
      setFeedback('Đã đưa bài vào hàng xử lý: ' + (JOB_STATUS[value.status] ?? value.status) + '. Chưa phải kết quả đọc mới.');
      setConfirm(null); setReload(value => value + 1);
    } catch (caught) { setActionError(messageOf(caught)); }
    finally { lock.current = false; setBusy(false); }
  }
  const target = (next: number, status?: string) => {
    const values = new URLSearchParams(query); values.set('page', String(next));
    if (status !== undefined) { if (status) values.set('status', status); else values.delete('status'); }
    return '/team/kho?' + values;
  };
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.page_size || 20)));
  return <div className={styles.page}>
    <Intro title="Kho dữ liệu" description="Kiểm nguồn, nội dung đã thu và lần xử lý gần nhất. Mỗi bài giữ rõ bộ dữ liệu của mình.">
      {hasRole(user, 'researcher') && <ExportData />}
    </Intro>
    {data && <section className={styles.stats} aria-label="Số bài theo trạng thái trong toàn kho">{Object.entries(data.by_status).map(([status, count]) => <Link prefetch={false} href={target(1, params.get('status') === status ? '' : status)} aria-current={params.get('status') === status ? 'page' : undefined} key={status}><strong>{count.toLocaleString('vi-VN')}</strong><span>{POST_STATUS[status] ?? status}</span></Link>)}</section>}
    {data && <p className={s.hint}>Các số trạng thái tính trên toàn kho; danh sách bên dưới theo bộ lọc.</p>}
    <form key={query} action="/team/kho" className={styles.filters}>
      <label className={s.field}><span className={s.label}>Trạng thái</span><select name="status" className={s.select} defaultValue={params.get('status') ?? ''}><option value="">Tất cả</option>{Object.entries(POST_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className={s.field}><span className={s.label}>Nhóm Facebook (tên hoặc ID)</span><input name="group" className={s.input} defaultValue={params.get('group') ?? ''} /></label>
      <label className={s.field}><span className={s.label}>Người thu</span><input name="collector" className={s.input} defaultValue={params.get('collector') ?? ''} /></label>
      <label className={s.field}><span className={s.label}>Loại bài</span><select name="post_type" className={s.select} defaultValue={params.get('post_type') ?? ''}><option value="">Tất cả</option>{Object.entries(POST_TYPE).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className={s.field}><span className={s.label}>Ngày thu từ</span><input type="date" name="date_from" className={s.input} defaultValue={params.get('date_from')?.slice(0, 10) ?? ''} /></label>
      <label className={s.field}><span className={s.label}>Ngày thu đến</span><input type="date" name="date_to" className={s.input} min={params.get('date_from')?.slice(0, 10)} defaultValue={params.get('date_to')?.slice(0, 10) ?? ''} /></label>
      <div className={styles.filterActions}><Button type="submit">Lọc kho</Button><Link prefetch={false} className={[s.button, s.secondary].join(' ')} href="/team/kho">Xóa lọc</Link></div>
    </form>
    {feedback && <p className={s.notice} role="status">{feedback}</p>}
    {error ? <ErrorNotice message={error} retry={() => setReload(value => value + 1)} /> : !data ? <Loading label="Đang tải kho dữ liệu…" /> : !data.items.length ? <Empty title="Không có bài khớp bộ lọc"><p>Thử bỏ bớt điều kiện hoặc quay về toàn bộ kho.</p><Link className={s.textLink} href="/team/kho">Xem toàn kho</Link></Empty> : <>
      <p className={styles.results}><strong>{data.total.toLocaleString('vi-VN')} bài trong lựa chọn</strong><span>Trang {page}/{totalPages} · Bấm “Mở bài” để đọc nguyên văn.</span></p>
      <div className={styles.tableFrame} role="region" tabIndex={0} aria-label="Danh sách kho dữ liệu"><table className={styles.table} role="table">
        <thead><tr><th scope="col">Bài đã thu</th><th scope="col">Nguồn / thời điểm</th><th scope="col">Loại / trạng thái</th><th scope="col">Xử lý</th><th scope="col">Thao tác</th></tr></thead>
        <tbody>{data.items.map(post => <tr key={post.post_id}>
          <td data-label="Bài đã thu"><p data-quote><Phrases text={post.excerpt} /></p><div className={styles.badges}><DataBadge demo={post.is_demo} /><span>{post.contributed ? 'Đã đóng góp' : 'Chưa đóng góp'}</span>{!post.text_complete && <span className={s.badge}>Nội dung chưa đủ</span>}</div><p className={s.mono}>{post.post_id}</p><p className={s.hint}>{post.listing_count.toLocaleString('vi-VN')} tin</p></td>
          <td data-label="Nguồn / thời điểm"><strong>{SOURCE[post.source_type] ?? post.source_type}</strong><p><Phrases text={post.source_group_name ?? 'Không có nhóm nguồn'} /></p><p className={s.hint}>Đăng: {formatDate(post.posted_at)}<br />Thu: {formatDate(post.first_seen_at)}</p><p className={s.mono}>{post.collector}</p></td>
          <td data-label="Loại / trạng thái">{POST_TYPE[post.post_type ?? ''] ?? 'Chưa phân loại'}<p className={s.hint}>{POST_STATUS[post.status] ?? post.status}</p></td>
          <td data-label="Xử lý">{post.job ? <><span>{JOB_STATUS[post.job.status] ?? post.job.status}</span><p className={s.hint}>Lần thử {post.job.attempt.toLocaleString('vi-VN')}</p>{post.job.error_code && <p className={s.mono}>{post.job.error_code}</p>}</> : <span>Chưa có lần xử lý</span>}</td>
          <td data-label="Thao tác"><div className={styles.actions}>{(post.collector === user.username || hasRole(user, 'reviewer', 'researcher')) && <Link prefetch={false} className={[s.button, s.secondary].join(' ')} href={'/phan-tich/' + encodeURIComponent(post.post_id)}>Mở bài</Link>}{hasRole(user, 'reviewer') && <Button variant="ghost" disabled={busy} onClick={event => { trigger.current = event.currentTarget; setActionError(''); setConfirm(post); }}>Xử lý lại</Button>}</div></td>
        </tr>)}</tbody>
      </table></div>
      <nav className={styles.pager} aria-label="Phân trang kho"><span>Trang {page}/{totalPages}</span><div className={styles.actions}>{page > 1 && <Link prefetch={false} className={[s.button, s.secondary].join(' ')} href={target(page - 1)}>Trang trước</Link>}{page < totalPages && <Link prefetch={false} className={[s.button, s.secondary].join(' ')} href={target(page + 1)}>Trang sau</Link>}</div></nav>
    </>}
    {confirm && <Modal title="Xử lý lại bài này?" busy={busy} onClose={close}><p data-quote><Phrases text={confirm.excerpt} /></p><p className={s.section}>Tạo một lượt xử lý mới trên nội dung hiện có. Kết quả chỉ đổi sau khi tác vụ hoàn tất.</p>{actionError && <ErrorNotice message={actionError} />}<div className={s.actions}><Button variant="secondary" disabled={busy} onClick={close}>Hủy</Button><Button busy={busy} onClick={reprocess}>{busy ? 'Đang gửi yêu cầu…' : 'Đưa vào hàng xử lý'}</Button></div></Modal>}
  </div>;
}

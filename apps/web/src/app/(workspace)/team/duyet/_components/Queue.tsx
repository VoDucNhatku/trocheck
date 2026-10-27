'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, messageOf, WorkspaceError } from '@/lib/workspace/client';
import type { ReviewDecision, ReviewQueue, ReviewSaved } from '@/lib/workspace/types';
import { formatDate, PROPERTY_LABEL } from '@/lib/format';
import { Button, DataBadge, Empty, ErrorNotice, Intro, Loading, Modal, s } from '@/features/workspace/ui';
import { Phrases, REASON_NAME } from './display';
import styles from './review.module.css';

const PAGE_SIZE = 20;
// The API filters only explicit review reasons, not its fallback display label.
const FILTERS = Object.entries(REASON_NAME).filter(([key]) => key !== 'field_needs_review');
const DECISION_NAME: Record<string, string> = { approve: 'Đã chấp nhận tin.', reject: 'Đã loại tin.', split: 'Đã tách tin khỏi cụm trùng.', merge: 'Đã gộp tin vào cụm trùng.' };
type Result = { id: string; ok: boolean; message: string };

export function Queue({ query }: { query: string }) {
  const params = new URLSearchParams(query);
  const page = Number(params.get('page')) || 1;
  const [data, setData] = useState<ReviewQueue | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [feedback, setFeedback] = useState('');
  const lock = useRef(false);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const all = !!data?.items.length && data.items.every(item => selected.has(item.listing_id));
  useEffect(() => { if (!confirm) returnFocus.current?.focus(); }, [confirm]);

  useEffect(() => { setFeedback(DECISION_NAME[new URLSearchParams(window.location.search).get('decision') ?? ''] ?? ''); }, []);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError(''); setSelected(new Set());
    api<ReviewQueue>('team/reviews?' + query + '&page_size=' + PAGE_SIZE, { signal: controller.signal })
      .then(setData).catch(caught => {
        if (controller.signal.aborted) return;
        if (caught instanceof WorkspaceError && caught.status === 403) window.location.replace('/team/403');
        else setError(messageOf(caught));
      });
    return () => controller.abort();
  }, [query, reload]);

  function toggle(id: string, checked: boolean) {
    setSelected(current => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next; });
  }
  function close() { if (!lock.current) { setConfirm(null); setActionError(''); } }
  async function decide() {
    if (!confirm || !data || lock.current) return;
    if (confirm === 'reject' && !reason.trim()) { setActionError('Hãy nhập lý do loại các tin đã chọn.'); return; }
    lock.current = true; setBusy(true); setActionError('');
    const outcomes: Result[] = [];
    for (const item of data.items.filter(row => selected.has(row.listing_id))) {
      const body: ReviewDecision = { action: confirm, expected_version: item.version, ...(reason.trim() ? { reason: reason.trim() } : {}) };
      try {
        await api<ReviewSaved>('team/reviews/' + encodeURIComponent(item.listing_id) + '/decision', { method: 'POST', body: JSON.stringify(body) });
        outcomes.push({ id: item.listing_id, ok: true, message: 'Đã lưu quyết định' });
      } catch (caught) {
        outcomes.push({ id: item.listing_id, ok: false, message: caught instanceof WorkspaceError && caught.status === 409 ? 'Tin đã được người khác sửa — mở lại để đối chiếu' : messageOf(caught) });
        // A failed request can have reached the server; never automatically repeat it.
      }
    }
    setResults(outcomes); setConfirm(null); setReason(''); setBusy(false); lock.current = false; setReload(value => value + 1);
  }
  const target = (next: number) => { const values = new URLSearchParams(query); values.set('page', String(next)); return '/team/duyet?' + values; };
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return <div className={styles.page}>
    <Intro title="Hàng duyệt" description="Tin máy đọc chưa chắc. Đối chiếu bài gốc trước khi quyết định; mỗi lần lưu giữ phiên bản, người duyệt và lý do."><Link className={[s.button, s.secondary].join(' ')} href="/team/kho">Mở kho dữ liệu</Link></Intro>
    {feedback && <p role="status" className={s.notice}>{feedback}</p>}
    <nav className={styles.reasons} aria-label="Lọc nhanh theo lý do">{[['', 'Tất cả'], ...FILTERS].map(([key, label]) => <Link key={key} href={key ? '/team/duyet?reason=' + key : '/team/duyet'} className={styles.chip} aria-current={(params.get('reason') ?? '') === key ? 'page' : undefined}>{label}{data && key && <b>{(data.counts[key] ?? 0).toLocaleString('vi-VN')}</b>}</Link>)}</nav>
    <form key={query} action="/team/duyet" className={styles.filters}><label className={s.field}><span className={s.label}>Lý do cần duyệt</span><select name="reason" className={s.select} defaultValue={params.get('reason') ?? ''}><option value="">Tất cả lý do</option>{FILTERS.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><Button type="submit">Lọc hàng duyệt</Button></form>
    {results.length > 0 && <section className={s.notice} role="status"><h2 className={s.panelTitle}>Kết quả duyệt nhiều tin</h2><p>{results.filter(row => row.ok).length} tin đã lưu · {results.filter(row => !row.ok).length} tin chưa lưu</p><ul className={s.questions}>{results.map(row => <li key={row.id}>{row.ok ? row.message : <Link className={s.textLink} href={'/team/duyet/' + row.id}>{row.message}</Link>} · <span className={s.mono}>{row.id}</span></li>)}</ul></section>}
    {error ? <ErrorNotice message={error} retry={() => setReload(value => value + 1)} /> : !data ? <Loading label="Đang tải hàng duyệt…" /> : !data.items.length ? <Empty title={page > 1 ? 'Trang này không còn tin chờ duyệt' : 'Hàng duyệt trống'}><p>Không có tin cần xem trong lựa chọn này.</p><Link className={s.textLink} href="/team/duyet">Xem tất cả tin đang chờ</Link></Empty> : <>
      <div className={styles.meta}><p><strong>{data.total.toLocaleString('vi-VN')}</strong> tin đang chờ · Trang {page}/{totalPages}</p><span className={[s.muted, styles.scrollHint].join(' ')}>Cuộn ngang trong bảng để xem đủ cột.</span></div>
      <div className={styles.tableFrame} tabIndex={0} role="region" aria-label="Danh sách hàng duyệt"><table className={styles.table} role="table"><thead><tr><th scope="col"><label><input type="checkbox" aria-label="Chọn tất cả trên trang" checked={all} onChange={event => setSelected(event.target.checked ? new Set(data.items.map(item => item.listing_id)) : new Set())} /><span className={styles.mobileSelectLabel}>Chọn tất cả trên trang</span></label></th><th scope="col">Lý do / bài đăng</th><th scope="col">Phòng / vị trí</th><th scope="col">Đưa vào hàng</th><th scope="col">Thao tác</th></tr></thead><tbody>{data.items.map(item => <tr key={item.listing_id} aria-selected={selected.has(item.listing_id)} tabIndex={0} onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter') event.currentTarget.querySelector<HTMLAnchorElement>('a')?.click();
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const next = event.key === 'ArrowDown' ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling; (next as HTMLElement | null)?.focus(); }
      }}><td data-label="Chọn tin"><label><input type="checkbox" checked={selected.has(item.listing_id)} aria-label={'Chọn tin ' + item.listing_id} onChange={event => toggle(item.listing_id, event.target.checked)} /></label></td>
        <td data-label="Lý do / bài đăng">{(item.reasons.length ? item.reasons : ['field_needs_review']).map(reason => <p key={reason}>{REASON_NAME[reason] ?? REASON_NAME.field_needs_review}</p>)}<Link className={styles.excerpt} href={'/team/duyet/' + item.listing_id} data-quote><Phrases text={item.excerpt} /></Link><DataBadge demo={item.is_demo} /></td>
        <td data-label="Phòng / vị trí"><Phrases text={PROPERTY_LABEL[item.property_type]} /><br /><span className={s.muted}><Phrases text={item.ward_name ?? 'Chưa rõ phường'} /></span></td><td data-label="Đưa vào hàng"><span className={styles.phrase}>{formatDate(item.created_at)}</span><p className={s.hint}>Phiên bản {item.version}</p></td><td data-label="Thao tác"><Link className={[s.button, s.secondary].join(' ')} href={'/team/duyet/' + item.listing_id}>Mở duyệt</Link></td></tr>)}</tbody></table></div>
      <nav className={[s.between, s.section].join(' ')} aria-label="Phân trang hàng duyệt"><span>Trang {page}/{totalPages}</span><div className={s.row}>{page > 1 && <Link className={[s.button, s.secondary].join(' ')} href={target(page - 1)}>Trang trước</Link>}{page < totalPages && <Link className={[s.button, s.secondary].join(' ')} href={target(page + 1)}>Trang sau</Link>}</div></nav>
      {selected.size > 0 && <div className={styles.batch}><p>Đã chọn {selected.size} tin</p>{(['approve', 'reject'] as const).map(action => <Button key={action} variant={action === 'reject' ? 'danger' : undefined} onClick={event => { returnFocus.current = event.currentTarget; setConfirm(action); setActionError(''); }}>{action === 'approve' ? 'Duyệt' : 'Loại'} {selected.size} tin</Button>)}<Button variant="secondary" onClick={() => setSelected(new Set())}>Bỏ chọn</Button></div>}
    </>}
    {confirm && <Modal title={(confirm === 'approve' ? 'Duyệt ' : 'Loại ') + selected.size + ' tin?'} busy={busy} onClose={close}><p>Mỗi tin dùng phiên bản đang hiển thị. Tin đã được người khác sửa sẽ giữ lại để đối chiếu.</p>{confirm === 'reject' && <label className={[s.field, s.section].join(' ')}><span>Lý do loại các tin đã chọn</span><textarea className={s.textarea} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} /><span>{reason.length}/500 ký tự</span></label>}{actionError && <ErrorNotice message={actionError} />}<div className={s.actions}><Button variant="secondary" disabled={busy} onClick={close}>Hủy, tiếp tục đọc</Button><Button variant={confirm === 'reject' ? 'danger' : undefined} busy={busy} onClick={decide}>{busy ? 'Đang lưu từng tin…' : 'Xác nhận ' + (confirm === 'approve' ? 'duyệt' : 'loại') + ' các tin đã chọn'}</Button></div></Modal>}
  </div>;
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, WorkspaceError } from '@/lib/workspace/client';
import { ROLE_NAME, type Role } from '@/lib/workspace/types';
import s from './team-admin.module.css';

export function TeamHeader({ current, title, description }: { current: 'evaluation' | 'users' | 'sources'; title: string; description: string }) {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('theme');
    const value = requested === 'light' || requested === 'dark' ? requested : document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = value; setTheme(value);
  }, []);
  return <header className={s.header}><div><h1>{title}</h1><p>{description}</p></div><nav className={s.nav} aria-label="Quản trị và nghiên cứu">{[['evaluation', '/team/danh-gia', 'Đánh giá'], ['users', '/team/nguoi-dung', 'Người dùng'], ['sources', '/team/nguon-cao', 'Nguồn cào']].map(([key, href, label]) => <Link key={key} href={href} aria-current={current === key ? 'page' : undefined}>{label}</Link>)}<button type="button" aria-label={'Chuyển sang chế độ ' + (theme === 'dark' ? 'sáng' : 'tối')} onClick={() => { const value = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = value; setTheme(value); }}>{theme === 'dark' ? 'Sáng' : 'Tối'}</button></nav></header>;
}
export const displayDate = (value: string | null | undefined) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có thông tin';
export function StateBox({ title, error = false, children }: { title: string; error?: boolean; children?: React.ReactNode }) {
  return <section className={[s.status, error ? s.error : ''].join(' ')} role={error ? 'alert' : 'status'}><h2>{title}</h2>{children}</section>;
}
type DirectoryUser = { user_id: string; username: string; email: string | null; email_redacted: boolean; roles: Role[]; created_at: string | null };
type RecordedSource = { source_type: string; source_group_id: string | null; source_group_name: string | null; is_demo: boolean; posts_count: number; last_seen_at: string | null };
type DirectoryResult = { items: DirectoryUser[]; current_user_id: string; total: number; page: number; page_size: number };
type SourcesResult = { items: RecordedSource[]; configuration_available: false; total: number; page: number; page_size: number };
const SOURCE_NAMES: Record<string, string> = { facebook_group: 'Nhóm Facebook', manual_paste: 'Dán thủ công', import_file: 'Nhập từ tệp', fixture: 'Dữ liệu mẫu' };
function sourceName(value: string) {
  return value.split(/(Cầu Giấy|Dịch Vọng Hậu)/).map((part, i) => /^(Cầu Giấy|Dịch Vọng Hậu)$/.test(part) ? <span key={i} className={s.phrase}>{part}</span> : part);
}

export function TeamDirectory({ kind, admin = false }: { kind: 'users' | 'sources'; admin?: boolean }) {
  const [query, setQuery] = useState(''), [role, setRole] = useState('');
  const [filters, setFilters] = useState({ q: '', role: '' });
  const [page, setPage] = useState(1), [reload, setReload] = useState(0);
  const [result, setResult] = useState<DirectoryResult | SourcesResult | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError('');
    const params = new URLSearchParams({ page: String(page), page_size: '8' });
    if (kind === 'users') { if (filters.q) params.set('q', filters.q); if (filters.role) params.set('role', filters.role); }
    api<DirectoryResult | SourcesResult>('team/' + kind + '?' + params, { signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(1, Math.ceil(value.total / 8));
      if (page > lastPage) setPage(lastPage);
      else setResult(value);
    }).catch(caught => {
      if (!controller.signal.aborted) setError(caught instanceof WorkspaceError && caught.status === 403 ? 'Bạn chưa có quyền xem dữ liệu này.' : 'Không tải được dữ liệu. Hãy thử lại.');
    });
    return () => controller.abort();
  }, [kind, page, filters, reload]);
  const users = kind === 'users' ? result as DirectoryResult | null : null;
  const sources = kind === 'sources' ? result as SourcesResult | null : null;
  return <div className={s.page}>
    <TeamHeader current={kind} title={kind === 'users' ? 'Người dùng' : 'Nguồn cào'} description={kind === 'users' ? 'Tra cứu tài khoản và vai trò đã được cấp trong nhóm.' : 'Xem các nguồn đã ghi nhận từ bài thu thập hoặc bài được đóng góp.'} />
    <p className={s.note}>{kind === 'users' ? <>Chỉ đọc. Chưa hỗ trợ tạo, khóa hoặc đổi quyền tài khoản tại đây. {!admin && 'Email được che; tìm kiếm chỉ theo tên tài khoản.'}</> : <>Chỉ đọc nguồn từ bài đã có. Chưa có cấu hình, lịch cào hay lịch sử chạy trong hệ thống; trang không khởi chạy bộ cào hoặc lưu ảnh phòng.</>}</p>
    {kind === 'users' && <form className={s.filters} onSubmit={event => { event.preventDefault(); setPage(1); setFilters({ q: query.trim(), role }); }}><label className={s.field}>Tìm tài khoản<input value={query} onChange={event => setQuery(event.target.value)} maxLength={100} placeholder={admin ? 'Tên hoặc email…' : 'Tên tài khoản…'} /></label><label className={s.field}>Vai trò<select value={role} onChange={event => setRole(event.target.value)}><option value="">Tất cả vai trò</option>{Object.entries(ROLE_NAME).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><button type="submit">Lọc tài khoản</button></form>}
    <div className={s.actions}><button type="button" onClick={() => setReload(value => value + 1)} disabled={!result && !error}>Tải lại dữ liệu</button>{kind === 'users' && <button type="button" onClick={() => { setQuery(''); setRole(''); setFilters({ q: '', role: '' }); setPage(1); }}>Xóa lọc</button>}</div>
    {error ? <StateBox error title={error}><button type="button" onClick={() => setReload(value => value + 1)}>Thử lại</button></StateBox> : !result ? <StateBox title="Đang tải dữ liệu…" /> : <>
      <p className={s.muted}>{result.total.toLocaleString('vi-VN')} {kind === 'users' ? 'tài khoản khớp' : 'nguồn được ghi nhận'}</p>
      {result.items.length === 0 && <StateBox title={result.total ? 'Trang này chưa có dữ liệu' : kind === 'users' ? 'Không có tài khoản khớp' : 'Chưa có nguồn được ghi nhận'}><p>{kind === 'users' ? 'Thử bỏ bộ lọc hoặc đổi tên tìm kiếm.' : 'Nguồn sẽ xuất hiện khi có bài được thu hoặc đóng góp. Chưa có dữ liệu không có nghĩa là bộ cào đang tắt.'}</p></StateBox>}
      {users && users.items.length > 0 && <table className={s.table}><caption>Danh sách người dùng · chỉ các trường hồ sơ được phép xem</caption><thead><tr><th scope="col">Tài khoản</th><th scope="col">Email / vai trò</th><th scope="col">Ngày tạo</th></tr></thead><tbody>{users.items.map(user => <tr key={user.user_id}><th scope="row">{user.username} {user.user_id === users.current_user_id && <span className={s.badge}>Bạn</span>}</th><td data-label="Email / vai trò"><p>{!admin && user.email ? '***@***' : user.email ?? 'Chưa có email'}</p>{user.email_redacted && <p className={s.muted}>Email được che</p>}<div className={s.badges}>{user.roles.map(role => <span key={role} className={s.badge}>{ROLE_NAME[role] ?? 'Chưa rõ vai trò'}</span>)}</div></td><td data-label="Ngày tạo">{displayDate(user.created_at)}</td></tr>)}</tbody></table>}
      {sources && <div className={s.sourceGrid}>{sources.items.map((source, i) => <section className={s.panel} key={i}><div className={s.badges}><span className={s.badge}>{SOURCE_NAMES[source.source_type] ?? 'Nguồn khác'}</span><span className={s.badge}>{source.is_demo ? 'Ví dụ' : 'Nguồn đã ghi nhận'}</span></div><h2>{sourceName(source.source_group_name ?? (source.source_type === 'manual_paste' ? 'Bài dán thủ công' : 'Nguồn chưa có tên'))}</h2><dl className={s.meta}><div><dt>Số bài đã ghi nhận</dt><dd>{source.posts_count.toLocaleString('vi-VN')} bài</dd></div><div><dt>Lần thấy gần nhất</dt><dd>{displayDate(source.last_seen_at)}</dd></div><div><dt>Mã nhóm</dt><dd className={s.mono}>{source.source_group_id ?? 'Không có mã nhóm'}</dd></div></dl><p className={s.muted}>Chưa có thông tin lịch chạy, số ảnh hoặc lỗi bộ cào.</p></section>)}</div>}
      {result.total > 8 && <nav className={s.pager} aria-label="Phân trang"><button disabled={page === 1} type="button" onClick={() => setPage(value => value - 1)}>Trang trước</button><p>Trang {page.toLocaleString('vi-VN')} / {Math.ceil(result.total / 8).toLocaleString('vi-VN')}</p><button disabled={page * 8 >= result.total} type="button" onClick={() => setPage(value => value + 1)}>Trang sau</button></nav>}
    </>}
  </div>;
}

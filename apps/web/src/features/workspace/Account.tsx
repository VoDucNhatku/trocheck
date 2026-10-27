'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, messageOf } from '@/lib/workspace/client';
import { ROLE_NAME, type SessionUser, type TokenInfo, type TokenCreated } from '@/lib/workspace/types';
import { formatDate } from '@/lib/format';
import { Button, Empty, ErrorNotice, Intro, Loading, Modal, s } from './ui';

export function Account({ user }: { user: SessionUser }) {
  const [tokens, setTokens] = useState<TokenInfo[] | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reload, setReload] = useState(0);
  const [fresh, setFresh] = useState<TokenCreated | null>(null);
  const [revoke, setRevoke] = useState<TokenInfo | null>(null);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    api<{ items: TokenInfo[] }>('team/extension-tokens', { signal: controller.signal }).then(value => setTokens(value.items)).catch(caught => { if (!controller.signal.aborted) setError(messageOf(caught)); });
    return () => controller.abort();
  }, [reload]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy('create'); setActionError(''); setFresh(null); setFeedback('');
    const form = event.currentTarget; const name = String(new FormData(form).get('name') ?? '').trim();
    try { const result = await api<TokenCreated>('team/extension-tokens', { method: 'POST', body: JSON.stringify({ name: name || null }) }); setFresh(result); setReload(value => value + 1); form.reset(); }
    catch (caught) { setActionError(messageOf(caught)); }
    finally { lock.current = false; setBusy(''); }
  }
  async function revokeToken() {
    if (!revoke || lock.current) return; lock.current = true; setBusy('revoke'); setActionError('');
    try { await api('team/extension-tokens/' + encodeURIComponent(revoke.id), { method: 'DELETE', body: '{}' }); if (fresh?.id === revoke.id) setFresh(null); setRevoke(null); setReload(value => value + 1); setFeedback('Đã thu hồi kết nối.'); }
    catch (caught) { setActionError(messageOf(caught)); }
    finally { lock.current = false; setBusy(''); }
  }
  async function logout() {
    if (lock.current) return; lock.current = true; setBusy('logout'); setActionError(''); setFresh(null);
    try { await api('auth/logout', { method: 'POST', body: '{}' }); window.location.replace('/dang-nhap'); }
    catch (caught) { setActionError(messageOf(caught)); lock.current = false; setBusy(''); }
  }
  async function copyToken() {
    if (!fresh) return;
    try { await navigator.clipboard.writeText(fresh.token); setFeedback('Đã sao chép mã kết nối.'); }
    catch { setFeedback('Clipboard chưa được cho phép. Bạn có thể chọn mã và sao chép thủ công.'); }
  }
  return <><Intro title="Tài khoản & kết nối" eyebrow="Cá nhân" description="Quản lý phiên hiện tại và mã kết nối extension. Mã chỉ hiển thị một lần khi được tạo." />
    <div className={s.split}><section className={s.panel}><h2 className={s.panelTitle}>Thông tin tài khoản</h2><dl><dt className={s.muted}>Tên tài khoản</dt><dd style={{ margin: '5px 0 20px', fontSize: 20 }}>{user.username}</dd><dt className={s.muted}>Vai trò được cấp</dt><dd className={s.row} style={{ margin: '8px 0 20px' }}>{user.roles.map(role => <span className={s.badge} key={role}>{ROLE_NAME[role]}</span>)}</dd></dl>
      <p className={s.hint}>Quyền được kiểm tra lại trên máy chủ ở mỗi thao tác.</p><div className={s.actions}><Button variant="secondary" busy={busy === 'logout'} disabled={!!busy} onClick={logout}>{busy === 'logout' ? 'Đang đăng xuất…' : 'Đăng xuất phiên này'}</Button></div>
    </section><section className={s.panel}><h2 className={s.panelTitle}>Kết nối trình duyệt</h2><p className={s.muted}>Bạn có thể tạo và thu hồi mã kết nối tại đây. Extension Chrome chưa có bản cài đặt hoàn chỉnh.</p>
      <form method="post" onSubmit={create} className={s.section}><label className={s.field}><span className={s.label}>Tên kết nối (tùy chọn)</span><input className={s.input} name="name" maxLength={100} placeholder="Ví dụ: Chrome trên laptop" disabled={!!busy} /></label><div className={s.actions}><Button type="submit" busy={busy === 'create'} disabled={!!busy}>Tạo mã kết nối</Button></div></form>
      {fresh && <div className={[s.notice, s.section].join(' ')} data-sensitive><p>Mã này chỉ hiện một lần. Lưu ở nơi riêng tư và không chia sẻ cho người khác.</p><p className={[s.secret, s.section].join(' ')}>{fresh.token}</p><div className={s.actions}><Button variant="secondary" onClick={copyToken}>Sao chép mã</Button><Button variant="ghost" onClick={() => setFresh(null)}>Ẩn mã</Button></div></div>}
    </section></div>
    {actionError && !revoke && <div className={s.section}><ErrorNotice message={actionError} /></div>}<p role="status" className={s.muted} style={{ marginTop: 12 }}>{feedback}</p>
    <section className={[s.panel, s.section].join(' ')}><h2 className={s.panelTitle}>Các kết nối của bạn</h2>
      {error ? <ErrorNotice message={error} retry={() => setReload(reload + 1)} /> : !tokens ? <Loading /> : !tokens.length ? <Empty title="Chưa có kết nối"><p>Tạo mã khi bạn cần nối extension. Bạn vẫn đọc và phân tích bài trên web bình thường.</p></Empty> :
        <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Tên</th><th>Tạo / hết hạn</th><th>Lần dùng gần nhất</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{tokens.map(token => <tr key={token.id}><td>{token.name ?? 'Kết nối chưa đặt tên'}</td><td>{formatDate(token.created_at)}<br />{formatDate(token.expires_at)}</td><td>{token.last_used_at ? formatDate(token.last_used_at) : 'Chưa sử dụng'}</td><td>{token.revoked_at ? 'Đã thu hồi' : token.expires_at && Date.parse(token.expires_at) < Date.now() ? 'Đã hết hạn' : 'Còn hiệu lực'}</td><td>{!token.revoked_at && <Button variant="ghost" disabled={!!busy} onClick={() => { setRevoke(token); setActionError(''); }}>Thu hồi</Button>}</td></tr>)}</tbody></table></div>}
    </section>
    {revoke && <Modal title="Thu hồi mã kết nối?" onClose={() => setRevoke(null)} busy={busy === 'revoke'}><p>Kết nối “{revoke.name ?? 'Chưa đặt tên'}” sẽ không gửi yêu cầu được nữa. Bạn có thể tạo một mã khác sau đó.</p>{actionError && <ErrorNotice message={actionError} />}<div className={s.actions}><Button variant="secondary" autoFocus disabled={!!busy} onClick={() => setRevoke(null)}>Giữ kết nối</Button><Button variant="danger" busy={busy === 'revoke'} onClick={revokeToken}>Thu hồi mã</Button></div></Modal>}
  </>;
}

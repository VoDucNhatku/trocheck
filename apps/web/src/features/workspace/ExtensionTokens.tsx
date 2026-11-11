'use client';

import { useEffect, useState } from 'react';
import { api, messageOf } from '@/lib/workspace/client';
import { formatDate } from '@/lib/format';
import type { TokenCreated, TokenInfo } from '@/lib/workspace/types';
import { Button, Modal } from './ui';
import s from './account-notices.module.css';

/** The plain token exists only in this component's state: the API stores a hash and shows it once. */
export function ExtensionTokens() {
  const [items, setItems] = useState<TokenInfo[] | null>(null);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<TokenCreated | null>(null);
  const [revoking, setRevoking] = useState<TokenInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  async function load() {
    try { setItems((await api<{ items: TokenInfo[] }>('team/extension-tokens')).items); }
    catch (caught) { setError(messageOf(caught)); }
  }
  useEffect(() => { void load(); }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setFeedback('');
    try {
      setCreated(await api<TokenCreated>('team/extension-tokens', { method: 'POST', body: JSON.stringify({ name: name.trim() || null }) }));
      setName('');
      await load();
    } catch (caught) { setError(messageOf(caught)); }
    finally { setBusy(false); }
  }

  async function revoke() {
    if (!revoking || busy) return;
    setBusy(true); setError(''); setFeedback('');
    try {
      await api(`team/extension-tokens/${revoking.id}`, { method: 'DELETE' });
      setRevoking(null);
      setFeedback('Đã thu hồi kết nối.');
      await load();
    } catch (caught) { setError(messageOf(caught)); }
    finally { setBusy(false); }
  }

  const active = items?.filter(item => !item.revoked_at) ?? [];
  return <section className={s.panel} aria-labelledby="account-extension-title">
    <h2 id="account-extension-title">Các kết nối của bạn</h2>
    <p className={s.note}>Tạo mã rồi dán vào phần Cài đặt của extension TrọCheck Collector. Tài khoản cần có quyền thu dữ liệu mới gửi được bài về kho.</p>
    <form onSubmit={create}>
      <label>Tên kết nối (tùy chọn)<input value={name} maxLength={80} onChange={event => setName(event.target.value)} /></label>
      <Button type="submit" busy={busy}>Tạo mã kết nối</Button>
    </form>
    {created && <div role="status">
      <p className={s.note}>Mã chỉ hiện một lần. Hãy sao chép ngay.</p>
      <code data-sensitive>{created.token}</code>
      <Button type="button" variant="secondary" onClick={() => setCreated(null)}>Ẩn mã</Button>
    </div>}
    {feedback && <p role="status" className={s.note}>{feedback}</p>}
    {error && <p role="alert" className={s.error}>{error}</p>}
    {items && !active.length && <p className={s.note}>Chưa có kết nối nào.</p>}
    {active.length > 0 && <ul className={s.tokens}>{active.map(item => <li key={item.id}>
      <span><b>{item.name || 'Kết nối không tên'}</b>{item.expires_at && <small>Hết hạn {formatDate(item.expires_at)}</small>}</span>
      <Button type="button" variant="secondary" onClick={() => setRevoking(item)}>Thu hồi</Button>
    </li>)}</ul>}
    {revoking && <Modal title="Thu hồi kết nối?" busy={busy} onClose={() => setRevoking(null)}>
      <p className={s.note}>Extension đang dùng mã này sẽ không gửi được bài nữa.</p>
      <Button type="button" busy={busy} onClick={revoke}>Thu hồi mã</Button>
    </Modal>}
  </section>;
}

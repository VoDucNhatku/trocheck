'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/workspace/client';
import { ROLE_NAME, type SessionUser } from '@/lib/workspace/types';
import { Button } from './ui';
import { PersonalNav } from './PersonalNav';
import s from './account-notices.module.css';

export function Account({ user }: { user: SessionUser }) {
  const [profile, setProfile] = useState(user);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const lock = useRef(false);

  async function refresh() {
    if (lock.current) return;
    lock.current = true; setBusy('refresh'); setError(''); setFeedback('');
    try {
      const value = await api<SessionUser>('auth/me');
      // Only the public session fields belong in the profile, even if transport adds others.
      setProfile({ user_id: value.user_id, username: value.username, roles: value.roles });
      setFeedback('Thông tin tài khoản đã được cập nhật.');
    } catch {
      setError('Không tải được thông tin tài khoản. Hãy thử lại hoặc đăng nhập lại.');
    } finally { lock.current = false; setBusy(''); }
  }

  async function logout() {
    if (lock.current) return;
    lock.current = true; setBusy('logout'); setError(''); setFeedback('');
    try {
      await api('auth/logout', { method: 'POST', body: '{}' });
      window.location.replace('/dang-nhap');
    } catch {
      setError('Chưa đăng xuất được. Hãy thử lại.');
      lock.current = false; setBusy('');
    }
  }

  return <div className={s.page}>
    <header className={s.heading}><div><p className={s.eyebrow}>Cá nhân</p><h1>Tài khoản</h1><p>Quản lý thông tin, mật khẩu và kết nối của bạn.</p></div><PersonalNav current="account" /></header>
    {error && <div role="alert" className={s.error}><p>{error}</p><div className={s.actions}><Button variant="secondary" disabled={!!busy} onClick={refresh}>Thử tải lại thông tin</Button><Link href="/dang-nhap?next=%2Ftai-khoan">Đăng nhập lại</Link></div></div>}
    <p className={s.feedback} role="status">{busy === 'refresh' ? 'Đang tải thông tin tài khoản…' : feedback}</p>
    <div className={s.accountGrid}>
      <aside className={s.profile} aria-label="Thông tin tài khoản" aria-busy={busy === 'refresh'}>
        <span className={s.avatar} aria-hidden="true">{Array.from(profile.username)[0]?.toLocaleUpperCase('vi')}</span>
        <h2>{profile.username}</h2><p className={s.muted}>Chưa có thông tin email</p>
        <dl className={s.profileFields}><dt>Tên tài khoản</dt><dd>{profile.username}</dd><dt>Vai trò được cấp</dt><dd className={s.badges}>{profile.roles.map(role => <span className={s.badge} key={role}>{ROLE_NAME[role]}</span>)}</dd></dl>
        <p className={s.muted}>Các mục được cấp quyền hiện ở điều hướng.</p>
        <p className={s.profileNote}>Ảnh đại diện dùng chữ cái đầu của tên tài khoản.</p>
        <div className={s.actions}><Button variant="secondary" disabled={!!busy} busy={busy === 'refresh'} onClick={refresh}>Tải lại thông tin</Button><Button variant="secondary" disabled={!!busy} busy={busy === 'logout'} onClick={logout}>{busy === 'logout' ? 'Đang đăng xuất…' : 'Đăng xuất phiên này'}</Button></div>
      </aside>
      <div className={s.stack}>
        <section className={s.panel} aria-labelledby="account-email-title"><div className={s.panelHead}><h2 id="account-email-title">Email</h2><span className={s.muted}>Dùng để lấy lại mật khẩu</span></div><label className={s.field}><span>Email tài khoản</span><input type="email" disabled value="" placeholder="Chưa có thông tin" aria-describedby="email-status" /></label><p id="email-status" className={s.note}>Chưa thể xem hoặc thay đổi email tại đây. Nếu đã thêm email khi đăng ký, bạn vẫn có thể yêu cầu đặt lại mật khẩu.</p><Button variant="secondary" disabled aria-describedby="email-status">Lưu email</Button></section>
        <section className={s.panel} aria-labelledby="account-password-title"><h2 id="account-password-title">Đổi mật khẩu</h2><p className={s.note}>Dùng email đã gắn với tài khoản để yêu cầu đặt lại mật khẩu. Tài khoản chưa gắn email cần liên hệ quản trị nhóm.</p><ul className={s.rules} aria-label="Điều kiện mật khẩu"><li>Ít nhất 8 ký tự</li><li>Một chữ hoa</li></ul><Link href="/quen-mat-khau" className={s.primary}>Yêu cầu đặt lại mật khẩu</Link></section>
        <section className={s.panel} aria-labelledby="account-google-title"><div className={s.panelHead}><h2 id="account-google-title">Đăng nhập bằng Google</h2><span className={s.badge}>Chưa hỗ trợ</span></div><p className={s.note} id="google-status">Google chưa kết nối. Bạn tiếp tục đăng nhập bằng tên tài khoản và mật khẩu.</p><Button variant="secondary" disabled aria-describedby="google-status">Liên kết Google</Button></section>
        <section className={s.panel} aria-labelledby="account-extension-title"><h2 id="account-extension-title">Kết nối extension</h2><p className={s.note}>Chưa hỗ trợ quản lý kết nối extension trên trang tài khoản này. Bạn vẫn có thể phân tích bài trực tiếp trên web.</p><Link className={s.textLink} href="/phan-tich">Phân tích bài đăng</Link></section>
        <section className={s.panel} aria-labelledby="account-history-title"><h2 id="account-history-title">Bài đã phân tích</h2><p className={s.note}>Chưa có danh sách lịch sử tại đây. Để xem lại một bài, mở liên kết bản đọc bạn đã lưu sau khi phân tích.</p><Link className={s.textLink} href="/phan-tich">Phân tích bài mới</Link></section>
      </div>
    </div>
  </div>;
}

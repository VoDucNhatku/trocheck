'use client';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api, messageOf } from '@/lib/workspace/client';
import { safeReturnPath } from '@/lib/workspace/safe-path';
import { Button, ErrorNotice, s } from './ui';
export function Login({ next, expired }: { next: string; expired: boolean }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const values = new FormData(event.currentTarget);
    lock.current = true; setBusy(true); setError('');
    try {
      await api('auth/login', { method: 'POST', body: JSON.stringify({ username: values.get('username'), password: values.get('password') }) });
      window.location.replace(safeReturnPath(next));
    } catch (caught) { setError(messageOf(caught)); lock.current = false; setBusy(false); }
  }
  return <div data-workspace className={s.workspace}><main className={s.login} id="main" tabIndex={-1}>
    <div className={s.loginAside}><a className={s.brand} href="/">ReNER<small>VN</small></a><h1>Đọc một tin.<br />Hiểu từng khoản.</h1>
      <p>Một góc làm việc yên để nhìn lại giá, phí và những điều còn thiếu trong bài đăng tìm trọ.</p>
      <ol className={s.loginSteps}><li><b>01</b>Giữ nguyên lời người đăng</li><li><b>02</b>Tách giá thuê khỏi các khoản phí</li><li><b>03</b>So sánh khi có đủ căn cứ</li></ol></div>
    <section className={[s.panel, s.loginForm].join(' ')}><p className={s.eyebrow}>Bàn làm việc</p><h2>Đăng nhập ReNER</h2><p className={s.muted}>Sử dụng tài khoản được nhóm cấp.</p>
      <form method="post" onSubmit={submit} className={s.stack} style={{ marginTop: 28 }} aria-describedby={error ? 'login-error' : undefined}>
        {expired && <p className={s.notice}>Phiên đăng nhập đã kết thúc. Đăng nhập lại để tiếp tục.</p>}
        <div className={s.field}><label htmlFor="username" className={s.label}>Tên tài khoản</label><input id="username" className={s.input} name="username" autoComplete="username" required maxLength={80} disabled={busy} autoCapitalize="none" spellCheck={false} /></div>
        <div className={s.field}><label className={s.label} htmlFor="password">Mật khẩu</label><div className={s.password}><input id="password" className={s.input} type={visible ? 'text' : 'password'} name="password" autoComplete="current-password" required maxLength={200} disabled={busy} />
          <Button type="button" variant="ghost" className={s.iconButton} aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</Button></div></div>
        {error && <div id="login-error"><ErrorNotice message={error} /></div>}
        <Button type="submit" busy={busy}>{busy ? 'Đang xác minh…' : 'Vào bàn làm việc'}<ArrowRight size={15} /></Button>
      </form><hr className={s.divider} /><p className={s.hint}>Chưa có tài khoản hoặc cần đổi mật khẩu? Liên hệ người quản trị nhóm ReNER.</p><div className={s.actions}><a className={s.textLink} href="/">Về trang chủ</a></div>
    </section></main></div>;
}

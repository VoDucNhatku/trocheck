'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Mail, CheckCircle2, Link2Off } from 'lucide-react';
import { Logo } from '@/components/Logo/Logo';
import { workspaceFetch, WorkspaceError, messageOf } from '@/lib/workspace/client';
import a from '../dang-nhap/auth.module.css';
import s from './recovery.module.css';

export function RecoveryForm({ reset = false }: { reset?: boolean }) {
  const [theme, setTheme] = useState('light');
  const [variant, setVariant] = useState(false);
  const [ready, setReady] = useState(!reset);
  const [invalid, setInvalid] = useState(false);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const token = useRef('');
  const lock = useRef(false);
  const initialized = useRef(false);
  const rules = [Array.from(password).length >= 8, /\p{Uppercase}/u.test(password)];
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const query = new URLSearchParams(location.search);
    const requested = query.get('theme');
    const value = requested === 'light' || requested === 'dark' ? requested : document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = value; setTheme(value); setVariant(query.get('v') === 'b');
    if (reset) {
      token.current = new URLSearchParams(location.hash.slice(1)).get('token') || '';
      setInvalid(!token.current || token.current.length > 200); setReady(true);
      // Keep the secret only in component memory, out of URLs, referrers and storage.
      history.replaceState(null, '', location.pathname + location.search);
    }
  }, [reset]);
  useEffect(() => {
    if (!wait) return;
    const timer = setInterval(() => setWait(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [wait]);
  useEffect(() => { if (!busy) document.getElementById(Object.keys(fields)[0])?.focus(); }, [fields, busy]);
  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); if (lock.current || wait) return;
    const values = event ? new FormData(event.currentTarget) : null;
    const invalidFields: Record<string, string> = {};
    if (!reset && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) invalidFields.email = 'Nhập email đúng định dạng.';
    if (reset && (!rules.every(Boolean) || Array.from(password).length > 200)) invalidFields.password = 'Mật khẩu cần 8–200 ký tự và ít nhất một chữ hoa.';
    if (reset && values?.get('confirm_password') !== password) invalidFields.confirm_password = 'Mật khẩu nhập lại chưa khớp.';
    setFields(invalidFields); setError('');
    if (Object.keys(invalidFields).length) return;
    lock.current = true; setBusy(true);
    try {
      const response = await workspaceFetch('auth/password/' + (reset ? 'reset' : 'forgot'), {
        method: 'POST', body: JSON.stringify(reset ? { token: token.current, password, confirm_password: values?.get('confirm_password') } : { email: email.trim() }),
      });
      if (reset) { token.current = ''; setPassword(''); setDone(true); }
      else {
        const retry = Number(response.headers.get('Retry-After'));
        setSent(true); setWait(retry > 0 && Number.isFinite(retry) ? Math.ceil(retry) : 60);
        if (retry > 0) setError('Bạn đã gửi nhiều yêu cầu. Hãy đợi trước khi thử lại.');
      }
    } catch (caught) {
      if (caught instanceof WorkspaceError && caught.status === 400) { token.current = ''; setInvalid(true); }
      else if (caught instanceof WorkspaceError) {
        setFields(caught.fields);
        setError(caught.status === 429 ? 'Bạn thử quá nhiều lần. Hãy đợi một lúc rồi thử lại.' : caught.message);
      } else setError(messageOf(caught));
    } finally { lock.current = false; setBusy(false); }
  }
  function passwordField(name: string, label: string) {
    return <div className={a.field}><label htmlFor={name}>{label}</label><div className={a.password}>
      <input id={name} name={name} type={visible[name] ? 'text' : 'password'} autoComplete="new-password" required disabled={busy} aria-invalid={!!fields[name]} aria-describedby={name + '-help' + (fields[name] ? ' ' + name + '-error' : '')} {...(name === 'password' ? { value: password, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setPassword(event.target.value) } : {})} />
      <button type="button" aria-label={(visible[name] ? 'Ẩn ' : 'Hiện ') + label.toLowerCase()} aria-pressed={!!visible[name]} onClick={() => setVisible({ ...visible, [name]: !visible[name] })}>{visible[name] ? 'Ẩn' : 'Hiện'}</button></div>
      <small className={a.srOnly} id={name + '-help'}>Tối đa 200 ký tự.</small>{fields[name] && <span className={a.fieldError} id={name + '-error'}>{fields[name]}</span>}</div>;
  }
  const heading = !ready ? 'Đang mở liên kết…' : invalid ? 'Link này không còn dùng được.' : done ? 'Mật khẩu mới đã sẵn sàng.' : sent ? 'Đã nhận yêu cầu.' : reset ? 'Đặt mật khẩu mới' : 'Quên mật khẩu';
  return <div className={[a.page, s.page].join(' ')} data-variant={variant ? 'b' : 'a'}>
    <main id="main" className={a.main} tabIndex={-1}><div className={a.top}><a href="/" aria-label="TrọCheck — Trang chủ"><Logo /></a><button className={a.theme} type="button" aria-label={'Chuyển sang chế độ ' + (theme === 'dark' ? 'sáng' : 'tối')} onClick={() => { const value = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = value; setTheme(value); }}>{theme === 'dark' ? 'Sáng' : 'Tối'}</button></div>
      <div className={a.content}>
        {(sent || done || invalid) && <div className={s.statusIcon} aria-hidden="true">{invalid ? <Link2Off /> : done ? <CheckCircle2 /> : <Mail />}</div>}
        <h1>{heading}</h1>
        {error && <p className={a.error} role="alert">{error}</p>}
        {ready && !invalid && !done && !sent && <><p className={s.lead}>{reset ? 'Chọn mật khẩu mới cho tài khoản của bạn.' : 'Nhập email đã gắn với tài khoản để yêu cầu đặt lại mật khẩu.'}</p>
          <form className={a.form} method="post" noValidate onSubmit={submit} aria-busy={busy}>
            {reset ? <>{passwordField('password', 'Mật khẩu mới')}<div className={a.rules} aria-live="polite"><span data-valid={rules[0]}>{rules[0] ? '✓' : '○'} Ít nhất 8 ký tự</span><span data-valid={rules[1]}>{rules[1] ? '✓' : '○'} Một chữ hoa</span></div>{passwordField('confirm_password', 'Nhập lại mật khẩu')}</> : <div className={a.field}><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} aria-invalid={!!fields.email} aria-describedby={'email-help' + (fields.email ? ' email-error' : '')} /><small id="email-help">Dùng email đã nhập khi tạo tài khoản.</small>{fields.email && <span className={a.fieldError} id="email-error">{fields.email}</span>}</div>}
            <button className={a.primary} type="submit" disabled={busy}>{busy ? 'Đang gửi…' : reset ? 'Lưu mật khẩu mới' : 'Gửi link đặt lại'}</button>
          </form></>}
        {sent && <div className={s.result}><p>Nếu email này có tài khoản TrọCheck, yêu cầu khôi phục sẽ được xử lý. Link có hạn <span className={a.phrase}>30 phút</span> và chỉ dùng một lần.</p><p className={a.note}>Chưa có dịch vụ gửi email. Ở chế độ phát triển, quản trị viên xem link trong log máy chủ. Tài khoản chưa gắn email cần liên hệ quản trị nhóm.</p><button className={a.primary} type="button" onClick={() => submit()} disabled={busy || wait > 0}>{busy ? 'Đang gửi…' : wait > 0 ? `Gửi lại sau ${wait} giây` : 'Gửi lại'}</button><button className={s.changeEmail} type="button" disabled={busy} onClick={() => { setSent(false); setError(''); }}>Nhập email khác</button></div>}
        {invalid && <div className={s.result}><p>Link này đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới để tiếp tục.</p><a className={a.primary} href="/quen-mat-khau">Gửi link mới</a></div>}
        {done && <div className={s.result}><p>Đã đặt lại mật khẩu. Các phiên đăng nhập và kết nối tiện ích trước đó đã bị thu hồi.</p><a className={a.primary} href="/dang-nhap">Đăng nhập</a></div>}
        {!reset && !sent && <p className={s.devNote}>Chưa gửi email tự động. Trong bản phát triển, liên hệ quản trị nhóm để nhận link từ log máy chủ.</p>}
        <nav className={s.bottom} aria-label="Điều hướng tài khoản"><a href="/dang-nhap">Quay lại đăng nhập</a><a href="/tim-tro">Xem tin trọ trước</a></nav>
      </div><footer className={a.footer}><a href="/">Quay lại trang chủ</a><a href="/dang-ky#terms">Điều khoản và dữ liệu</a></footer>
    </main>
    <aside className={a.aside}><section className={a.receipt} aria-label="Phiếu đọc ví dụ"><span className={a.tag}>PHIẾU ĐỌC · VÍ DỤ TỰ TẠO</span><strong>4.400.000 đ <small>/tháng</small></strong><dl><div><dt>Diện tích</dt><dd>25 m²</dd></div><div><dt>Vị trí</dt><dd>Cầu Giấy</dd></div><div><dt>Điện</dt><dd>3.500 đ/số</dd></div><div><dt>Nước</dt><dd>100.000 đ/người</dd></div><div><dt>Đặt cọc</dt><dd>1 tháng</dd></div></dl></section><p>Ví dụ tự tạo · Giá chào thuê trong bài đăng,<br />không phải giá giao dịch.</p></aside>
  </div>;
}

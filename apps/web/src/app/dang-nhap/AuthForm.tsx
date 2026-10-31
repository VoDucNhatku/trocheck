'use client';

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { Logo } from '@/components/Logo/Logo';
import { api, messageOf, WorkspaceError } from '@/lib/workspace/client';
import { safeReturnPath } from '@/lib/workspace/safe-path';
import styles from './auth.module.css';

export function AuthForm({ next, register = false, expired = false, variant = false, oauthError = '' }: {
  next: string; register?: boolean; expired?: boolean; variant?: boolean; oauthError?: string;
}) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState('light');
  const lock = useRef(false);
  const rules = [Array.from(password).length >= 8, /\p{Uppercase}/u.test(password)];
  function revealTerms() {
    const details = document.getElementById('terms');
    if (details instanceof HTMLDetailsElement) {
      details.open = true;
      details.querySelector('summary')?.focus();
    }
  }
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('theme');
    const value = requested === 'light' || requested === 'dark' ? requested : document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = value; setTheme(value);
  }, []);
  useEffect(() => {
    if (!register) return;
    const revealHash = () => { if (location.hash === '#terms') revealTerms(); };
    revealHash();
    window.addEventListener('hashchange', revealHash);
    return () => window.removeEventListener('hashchange', revealHash);
  }, [register]);
  useEffect(() => {
    if (!busy) document.getElementById(Object.keys(fields)[0])?.focus();
  }, [busy, fields]);
  function back(event: MouseEvent<HTMLAnchorElement>) {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
      event.preventDefault(); history.back();
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const values = new FormData(event.currentTarget);
    const username = String(values.get('username') ?? '').trim();
    const confirm = String(values.get('confirm_password') ?? '');
    const email = String(values.get('email') ?? '').trim();
    const accepted = values.get('accept_terms') === 'on';
    const invalid: Record<string, string> = {};
    if (!username) invalid.username = 'Nhập tên tài khoản của bạn.';
    else if (register && !/^[A-Za-z0-9_]{3,30}$/.test(username)) invalid.username = 'Dùng 3–30 ký tự: chữ không dấu, số hoặc gạch dưới.';
    else if (!register && username.includes('@')) invalid.username = 'Hiện chỉ hỗ trợ đăng nhập bằng tên tài khoản.';
    if (!password) invalid.password = 'Nhập mật khẩu.';
    else if (register && (!rules.every(Boolean) || Array.from(password).length > 200)) invalid.password = 'Mật khẩu cần 8–200 ký tự và ít nhất một chữ hoa.';
    if (register && confirm !== password) invalid.confirm_password = 'Mật khẩu nhập lại chưa khớp.';
    if (register && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid.email = 'Nhập email đúng định dạng.';
    if (register && !accepted) invalid.accept_terms = 'Bạn cần đồng ý điều khoản trước khi tạo tài khoản.';
    setError(''); setFields(invalid);
    if (Object.keys(invalid).length) return;
    lock.current = true; setBusy(true);
    try {
      await api(register ? 'auth/register' : 'auth/login', { method: 'POST', body: JSON.stringify({ username, password, ...(register ? { confirm_password: confirm, accept_terms: accepted, ...(email ? { email } : {}) } : {}) }) });
      await api('auth/me');
      setPassword('');
      window.location.replace(safeReturnPath(next));
    } catch (caught) {
      if (caught instanceof WorkspaceError) {
        setFields(caught.fields);
        setError(caught.status === 429 ? 'Bạn thử quá nhiều lần. Hãy đợi một lúc rồi thử lại.' : caught.status === 401 ? 'Tên tài khoản hoặc mật khẩu chưa đúng. Kiểm tra lại thông tin.' : caught.status === 403 ? 'Không thể đăng nhập. Liên hệ quản trị nhóm để kiểm tra quyền truy cập.' : caught.message);
      } else setError(messageOf(caught));
      lock.current = false; setBusy(false);
    }
  }
  function googleLogin() {
    if (lock.current) return;
    if (register && !(document.getElementById('accept_terms') as HTMLInputElement | null)?.checked) {
      setFields({ accept_terms: 'Bạn cần đồng ý điều khoản trước khi tạo tài khoản.' });
      return;
    }
    lock.current = true; setBusy(true);
    window.location.assign('/api/auth/google/start?next=' + encodeURIComponent(safeReturnPath(next)));
  }
  const validity = (name: string) => ({ 'aria-invalid': !!fields[name], 'aria-describedby': [name + '-help', fields[name] ? name + '-error' : ''].filter(Boolean).join(' ') });
  const fieldError = (name: string) => fields[name] && <span className={styles.fieldError} id={name + '-error'}>{fields[name]}</span>;
  const passwordField = (name: string, label: string) => <div className={styles.field}>
    <div className={styles.fieldHead}><label htmlFor={name}>{label}</label>{!register && <a href="/quen-mat-khau">Quên mật khẩu?</a>}</div>
    <div className={styles.password}><input id={name} name={name} type={visible[name] ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} required disabled={busy} {...(name === 'password' ? { value: password, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value) } : {})} {...validity(name)} />
      <button type="button" aria-label={(visible[name] ? 'Ẩn ' : 'Hiện ') + label.toLowerCase()} aria-pressed={!!visible[name]} onClick={() => setVisible({ ...visible, [name]: !visible[name] })}>{visible[name] ? 'Ẩn' : 'Hiện'}</button></div>
    <span id={name + '-help'} className={styles.srOnly}>{register ? 'Tối đa 200 ký tự.' : 'Nhập mật khẩu của tài khoản.'}</span>{fieldError(name)}
  </div>;
  return <div className={styles.page} data-variant={variant ? 'b' : 'a'}>
    <main id="main" className={styles.main} tabIndex={-1}>
      <div className={styles.top}><a href="/" aria-label="TrọCheck — Trang chủ"><Logo /></a><button className={styles.theme} type="button" onClick={() => { const value = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = value; setTheme(value); }} aria-label={'Chuyển sang chế độ ' + (theme === 'dark' ? 'sáng' : 'tối')}>{theme === 'dark' ? 'Sáng' : 'Tối'}</button></div>
      <div className={styles.content}><h1><span className={styles.phrase}>{register ? 'Tạo tài khoản' : 'Đăng nhập'}</span>{' '}<span className={styles.phrase}>TrọCheck</span></h1>
        {expired && <p className={styles.notice} role="status">Phiên đã hết hạn, đăng nhập lại để tiếp tục.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {oauthError && !error && <p className={styles.error} role="alert">{oauthError}</p>}
        <form className={styles.form} method="post" noValidate onSubmit={submit} aria-busy={busy}>
          <div className={styles.field}><label htmlFor="username">Tên tài khoản</label><input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={register ? 30 : 80} disabled={busy} {...validity('username')} /><small id="username-help">{register ? '3–30 ký tự: chữ không dấu, số hoặc gạch dưới' : 'Hiện chỉ hỗ trợ tên tài khoản, chưa hỗ trợ email.'}</small>{fieldError('username')}</div>
          {register && <div className={styles.field}><label htmlFor="email">Email</label><input id="email" name="email" type="email" maxLength={254} autoComplete="email" disabled={busy} {...validity('email')} /><small id="email-help">Không bắt buộc · Dùng để yêu cầu đặt lại mật khẩu.</small>{fieldError('email')}</div>}
          {passwordField('password', 'Mật khẩu')}
          {register && <><div className={styles.rules} aria-live="polite"><span data-valid={rules[0]}>{rules[0] ? '✓' : '○'} Ít nhất 8 ký tự</span><span data-valid={rules[1]}>{rules[1] ? '✓' : '○'} Một chữ hoa</span></div>{passwordField('confirm_password', 'Nhập lại mật khẩu')}
            <div><label className={styles.check}><input id="accept_terms" name="accept_terms" type="checkbox" required disabled={busy} {...validity('accept_terms')} /><span>Tôi đồng ý <a href="#terms" onClick={revealTerms}>điều khoản sử dụng</a></span></label><span id="accept_terms-help" className={styles.srOnly}>Cần đồng ý để tạo tài khoản.</span>{fieldError('accept_terms')}</div></>}
          {!register && <label className={styles.check}><input type="checkbox" disabled aria-describedby="remember-help" /><span>Giữ đăng nhập trên máy này</span></label>}
          <div className={styles.actions}><a href="/" onClick={back} className={styles.primary}>Quay lại</a><button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Đang gửi…' : register ? 'Tạo tài khoản' : 'Tiếp tục'}</button></div>
          <div className={styles.or}>hoặc tiếp tục với</div><button type="button" className={styles.google} disabled={busy} onClick={googleLogin} aria-describedby="google-help">Tiếp tục với Google</button><p id="google-help" className={styles.note}>Dùng email đã xác minh của Google để đăng nhập hoặc tạo tài khoản. Khi tiếp tục, bạn đồng ý <a href={register ? '#terms' : '/dang-ky#terms'} onClick={register ? revealTerms : undefined}>điều khoản sử dụng</a>.</p>
        </form>
        <p className={styles.switch}>{register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} <a href={(register ? '/dang-nhap' : '/dang-ky') + '?next=' + encodeURIComponent(next) + (variant ? '&v=b' : '')}>{register ? 'Đăng nhập' : 'Đăng ký ngay'}</a></p>
        <details id={register ? 'terms' : 'recovery'} className={styles.details}><summary>{register ? 'Điều khoản sử dụng' : 'Hỗ trợ đăng nhập'}</summary><p>{register ? 'TrọCheck là đồ án học tập. Kết quả đọc bài và so giá chỉ để tham khảo; hãy xác minh với người đăng trước khi thuê. Không gửi thông tin riêng tư của người khác. Bạn chủ động chọn khi đóng góp bài vào kho chung.' : 'Quên mật khẩu? Mở trang yêu cầu đặt lại. Tài khoản chưa gắn email cần liên hệ quản trị nhóm.'}</p>{!register && <a href="/quen-mat-khau">Yêu cầu đặt lại mật khẩu</a>}</details>
        {!register && <p className={styles.note} id="remember-help">Phiên đăng nhập theo thời hạn chung của hệ thống; chưa có tùy chọn ghi nhớ riêng.</p>}
      </div>
      <footer className={styles.footer}><a href={register ? '#terms' : '/dang-ky#terms'} onClick={register ? revealTerms : undefined}>Điều khoản và dữ liệu</a><a href="/tim-tro">Xem tin trọ trước</a></footer>
    </main>
    <aside className={styles.aside}><p>Từ một bài đăng, đến những điều rõ ràng</p><h2>Tiền nhà rõ.<br />Phí đứng riêng.</h2><div className={styles.paper}><span className={styles.tag}>Ví dụ tự tạo</span><p data-quote>Mình còn <mark data-entity="room">chung cư mini</mark> ở <mark data-entity="location">Cầu Giấy</mark>, gần điểm xe buýt.<br />Diện tích <mark data-entity="area">30 m²</mark>, có gác, WC riêng, nội thất cơ bản.<br />Giá <mark data-entity="price">4,7 tr/tháng/phòng</mark>. <mark data-entity="fee">Điện 3,5k/số</mark>, <mark data-entity="fee">nước 100k/người/tháng</mark>, <mark data-entity="fee">internet miễn phí</mark>.<br /><mark data-entity="fee">Cọc 1 tháng tiền thuê</mark>. Ngõ đi lại thoải mái, liên hệ [SĐT].</p></div><section className={styles.receipt} aria-label="Phiếu đọc ví dụ"><span className={styles.tag}>PHIẾU ĐỌC · VÍ DỤ</span><strong>4,7 tr <small>/tháng</small></strong><dl><div><dt>Diện tích</dt><dd>30 m²</dd></div><div><dt>Loại phòng</dt><dd>Chung cư mini</dd></div><div><dt>Vị trí</dt><dd>Cầu Giấy</dd></div><div><dt>Điện</dt><dd>3.500 đ/số</dd></div><div><dt>Nước</dt><dd>100.000 đ/người/tháng</dd></div><div><dt>Internet</dt><dd>Miễn phí</dd></div><div><dt>Đặt cọc</dt><dd>1 tháng tiền thuê</dd></div></dl></section><p>Ví dụ tự tạo · Dữ liệu 01/10–28/10/2026.<br />Giá chào thuê trong bài đăng, không phải giá giao dịch.</p></aside>
  </div>;
}

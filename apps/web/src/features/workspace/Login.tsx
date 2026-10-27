'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Logo } from '@/components/Logo/Logo';
import { api, messageOf, WorkspaceError } from '@/lib/workspace/client';
import { safeReturnPath } from '@/lib/workspace/safe-path';
import { Button, ErrorNotice, s } from './ui';
import a from './auth.module.css';

export function Login({ next, expired = false, register = false }: { next: string; expired?: boolean; register?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [password, setPassword] = useState('');
  const lock = useRef(false);
  const rules = [Array.from(password).length >= 8, /\p{Uppercase}/u.test(password), /\p{Nd}/u.test(password)];
  useEffect(() => {
    // Wait for React to re-enable inputs after the server rejects a submission.
    if (!busy && Object.keys(fields).length) document.getElementById(Object.keys(fields)[0])?.focus();
  }, [fields, busy]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const values = new FormData(event.currentTarget);
    const username = String(values.get('username') ?? '');
    const confirm = String(values.get('confirm_password') ?? '');
    const accepted = values.get('accept_terms') === 'on';
    const invalid: Record<string, string> = {};
    if (!username) invalid.username = 'Nhập tên tài khoản của bạn.';
    else if (register && !/^[A-Za-z0-9_]{3,30}$/.test(username)) invalid.username = 'Dùng 3–30 chữ không dấu, chữ số hoặc dấu gạch dưới.';
    if (!password) invalid.password = 'Nhập mật khẩu của bạn.';
    else if (register && (!rules.every(Boolean) || Array.from(password).length > 200)) invalid.password = 'Dùng 8–200 ký tự, có ít nhất một chữ hoa và một chữ số.';
    if (register && confirm !== password) invalid.confirm_password = 'Mật khẩu nhập lại chưa khớp.';
    if (register && !accepted) invalid.accept_terms = 'Bạn cần đồng ý điều khoản để tạo tài khoản.';
    setFields(invalid); setError('');
    if (Object.keys(invalid).length) return;
    lock.current = true; setBusy(true);
    try {
      await api(register ? 'auth/register' : 'auth/login', { method: 'POST', body: JSON.stringify({ username, password, ...(register ? { confirm_password: confirm, accept_terms: accepted } : {}) }) });
      window.location.replace(safeReturnPath(next));
    } catch (caught) {
      if (caught instanceof WorkspaceError && Object.keys(caught.fields).length) setFields(caught.fields);
      else setError(messageOf(caught));
      lock.current = false; setBusy(false);
    }
  }
  const fieldError = (name: string) => fields[name] && <p className={a.fieldError} id={name + '-error'} role="alert">{fields[name]}</p>;
  const validity = (name: string) => ({ 'aria-invalid': !!fields[name], 'aria-describedby': fields[name] ? name + '-error' : undefined });
  return <div data-workspace className={s.workspace}><main className={a.stage} id="main" tabIndex={-1}>
    <section className={[a.form, register ? a.register : ''].join(' ')}><a className={s.brand} href="/" aria-label="TrọCheck — trang chủ"><Logo /></a><div className={a.body}>
      <h1>{register ? 'Tạo tài khoản ReNER' : 'Đăng nhập ReNER'}</h1><p className={s.muted}>Đọc rõ tiền nhà, trước khi hỏi thuê.</p>
      <form method="post" noValidate onSubmit={submit} className={s.stack}>
        {expired && <p className={s.notice}>Phiên đăng nhập đã kết thúc. Đăng nhập lại để tiếp tục.</p>}
        <div className={s.field}><label htmlFor="username" className={s.label}>Tên tài khoản</label><input id="username" className={s.input} name="username" autoComplete="username" required maxLength={register ? 30 : 80} disabled={busy} autoCapitalize="none" spellCheck={false} {...validity('username')} />{register && !fields.username && <p className={s.hint}>3–30 chữ không dấu, chữ số hoặc dấu gạch dưới.</p>}{fieldError('username')}</div>
        <div className={s.field}><label className={s.label} htmlFor="password">Mật khẩu</label><div className={s.password}><input id="password" className={s.input} type={visible ? 'text' : 'password'} name="password" autoComplete={register ? 'new-password' : 'current-password'} required maxLength={register ? 400 : 200} disabled={busy} value={password} onChange={e => setPassword(e.target.value)} {...validity('password')} />
          <Button type="button" variant="ghost" className={s.iconButton} aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</Button></div>{fieldError('password')}
          {register && <div className={a.strength}><div role="meter" aria-label="Điều kiện mật khẩu đã đạt" aria-valuemin={0} aria-valuemax={3} aria-valuenow={rules.filter(Boolean).length} aria-valuetext={rules.filter(Boolean).length + ' trên 3 điều kiện'}>{rules.map((met, i) => <span key={i} data-met={met} />)}</div><p className={s.hint}>Ít nhất 8 ký tự · một chữ hoa · một chữ số</p></div>}
        </div>
        {register && <><div className={s.field}><label htmlFor="confirm_password" className={s.label}>Nhập lại mật khẩu</label><input id="confirm_password" className={s.input} name="confirm_password" type={visible ? 'text' : 'password'} autoComplete="new-password" maxLength={400} disabled={busy} {...validity('confirm_password')} />{fieldError('confirm_password')}</div>
          <div><label className={s.check}><input id="accept_terms" name="accept_terms" type="checkbox" disabled={busy} {...validity('accept_terms')} /><span>Tôi đồng ý <a href="#terms" className={s.textLink}>điều khoản sử dụng</a>.</span></label>{fieldError('accept_terms')}<details id="terms" className={a.terms}><summary>Điều khoản bản demo</summary><p>ReNER là bản demo học tập. Kết quả đọc tin và so sánh giá chỉ để tham khảo; hãy xác minh với người đăng trước khi thuê. Không gửi thông tin riêng tư của người khác. Bạn chủ động chọn khi đóng góp bài vào kho chung.</p></details></div></>}
        {error && <ErrorNotice message={error} />}
        <Button type="submit" busy={busy}>{busy ? register ? 'Đang tạo tài khoản…' : 'Đang xác minh…' : register ? 'Tạo tài khoản' : 'Vào bàn làm việc'}</Button>
      </form><p className={a.switch}>{register ? 'Đã có tài khoản?' : 'Lần đầu đến ReNER?'} <a className={s.textLink} href={(register ? '/dang-nhap' : '/dang-ky') + '?next=' + encodeURIComponent(next)}>{register ? 'Đăng nhập' : 'Tạo tài khoản'}</a></p><a className={s.textLink} href="/tim-tro">Xem tin trọ trước</a>
    </div><p className={s.hint}>Quên mật khẩu? Liên hệ quản trị nhóm.</p></section>
    <figure className={a.art}><div className={a.image}><img src="/images/rener-courtyard.png" alt="Minh họa sân nhà Việt Nam với cây xanh" /></div><figcaption><strong>Một góc để bắt đầu.</strong><span>Minh họa sân nhà ReNER · Không phải ảnh tin cho thuê</span></figcaption></figure>
  </main></div>;
}

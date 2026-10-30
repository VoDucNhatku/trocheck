'use client';
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import s from './workspace.module.css';
export { s };
/** False during SSR and until hydration, so a pre-hydration click cannot fall back to a native GET submit. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
export function Button({ variant, className = '', busy, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'secondary' | 'ghost' | 'danger'; busy?: boolean;
}) {
  const hydrated = useHydrated();
  return <button {...props} disabled={!hydrated || props.disabled || busy} aria-busy={busy || undefined} className={[s.button, variant ? s[variant] : '', className].join(' ')}>{children}</button>;
}
export function Intro({ title, description, children }: { eyebrow?: string; title: string; description: string; children?: ReactNode }) {
  return <div className={s.intro}><div><h1 className={s.title}>{title}</h1><p className={s.description}>{description}</p></div>{children}</div>;
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <div className={s.error} role="alert"><p>{message}</p>{retry && <Button variant="ghost" onClick={retry}>Thử lại</Button>}</div>;
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className={s.empty}><strong>{title}</strong><div>{children}</div></div>;
}
export function Loading({ label = 'Đang đọc dữ liệu…' }: { label?: string }) {
  return <div className={s.panel} role="status"><span className={s.muted}>{label}</span><div className={s.skeleton} /><div className={s.skeleton} style={{ width: '72%' }} /><div className={s.skeleton} style={{ width: '86%' }} /></div>;
}
export function Forbidden() {
  return <><Intro title="Bạn chưa có quyền vào khu này" description="Vai trò hiện tại không có quyền đọc dữ liệu hoặc thực hiện công việc này. Liên hệ người quản trị nhóm để được cấp đúng vai trò." /><a className={s.textLink} href="/phan-tich">Về bàn đọc tin</a></>;
}
export function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog data-workspace ref={ref} className={s.modal} aria-labelledby="confirm-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="confirm-title">{title}</h2>{children}
  </dialog>;
}
export function DataBadge({ demo }: { demo: boolean }) {
  return <span className={[s.badge, demo ? s.badgeDemo : ''].join(' ')}>{demo ? 'Dữ liệu demo tự tạo' : 'Kho thật'}</span>;
}

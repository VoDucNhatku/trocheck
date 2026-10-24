import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from '../shared.module.css';

export function Button({ variant = 'primary', busy = false, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; busy?: boolean; children: ReactNode }) {
  return <button type="button" {...props} disabled={busy || props.disabled} aria-busy={busy || undefined} className={[styles.button, styles[variant], className].filter(Boolean).join(' ')}>{busy ? 'Đang xử lý…' : children}</button>;
}

'use client';

import { useId, type InputHTMLAttributes } from 'react';
import styles from '../shared.module.css';

export function Field({ label, hint, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const description = `${id}-description`;
  const describedBy = [props['aria-describedby'], (hint || error) && description].filter(Boolean).join(' ') || undefined;
  return <div className={styles.field}><label className={styles.fieldLabel} htmlFor={id}>{label}</label><input {...props} id={id} className={[styles.input, props.className].filter(Boolean).join(' ')} aria-describedby={describedBy} aria-invalid={error ? true : props['aria-invalid']} />{hint && !error && <p id={description} className={styles.fieldHint}>{hint}</p>}{error && <p id={description} className={styles.fieldError} role="alert">{error}</p>}</div>;
}

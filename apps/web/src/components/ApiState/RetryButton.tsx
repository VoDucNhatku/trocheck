'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import styles from './state.module.css';

export function RetryButton({ reset }: { reset?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" className={styles.retry} disabled={pending} onClick={() => startTransition(() => {
    router.refresh();
    reset?.();
  })}>{pending ? 'Đang tải lại…' : 'Thử lại'}</button>;
}

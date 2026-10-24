import type { ReactNode } from 'react';
import styles from './StatusBadge.module.css';
export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'info' | 'warning';
}) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}

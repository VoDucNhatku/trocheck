import styles from './Logo.module.css';

/** Approved TroCheck image assets, unchanged from the shared brand files. */
export function Logo({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <span className={styles.logo} role="img" aria-label="TrọCheck" data-logo-inverse={inverse || undefined}>
      <img className={styles.mark} src="/brand/trocheck-icon.png" width={24} height={24} alt="" />
      {!compact && (
        <span className={styles.word} data-logo-wordmark>
          <img className={styles.light} src="/brand/trocheck-wordmark-light.png" width={108} height={24} alt="" />
          <img className={styles.dark} src="/brand/trocheck-wordmark-dark.png" width={108} height={24} alt="" />
        </span>
      )}
    </span>
  );
}

import styles from './Logo.module.css';

/** Wordmark: "Re" in ink, "NER" under a highlighter stroke, "VN" small. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={styles.logo}>
      <span className={styles.mark} aria-hidden="true">
        <span className={styles.bar} data-c="price" />
        <span className={styles.bar} data-c="area" />
        <span className={styles.bar} data-c="loc" />
      </span>
      {!compact && (
        <span className={styles.word}>
          Re<span className={styles.ner}>NER</span>
          <span className={styles.vn}>VN</span>
        </span>
      )}
    </span>
  );
}

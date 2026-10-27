import styles from './loading.module.css';

export default function Loading() {
  return (
    <div className={`container ${styles.page}`} aria-busy="true" aria-label="Đang tải danh sách tin">
      <div className={styles.title} />
      <div className={styles.bar} />
      <div className={styles.grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={styles.card}>
            <span style={{ width: '40%' }} />
            <span style={{ width: '60%', height: 26 }} />
            <span style={{ width: '80%' }} />
            <span style={{ width: '70%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

import styles from './loading.module.css';
export function ResultsLoading() {
  return <div aria-busy="true" role="status"><p className={styles.label}>Đang tải tin và nhận định giá…</p><div className={styles.grid} aria-hidden="true">{Array.from({length:6},(_,i)=><div className={styles.card} key={i}><div className={styles.media} /><span /><span /><span /></div>)}</div></div>;
}
export default function Loading() {
  return <div className={`container ${styles.page}`}><p className={styles.label}>Đang tải danh sách tin…</p><div className={styles.title} aria-hidden="true" /><ResultsLoading /></div>;
}

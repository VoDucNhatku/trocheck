import Link from 'next/link';
import styles from './page.module.css';
export default function NotFound() {
  return <div className={`container ${styles.page} ${styles.notFound}`}><h1>Không tìm thấy tin</h1><p>Tin không tồn tại hoặc chưa được công khai trong kho đang chọn.</p><Link className={styles.back} href="/tim-tro">Về Tìm trọ</Link></div>;
}

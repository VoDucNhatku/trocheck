import Link from 'next/link';
import type { SearchParams } from './filters';
import { searchUrl } from './filters';
import styles from './Pagination.module.css';

export function Pagination({ page, pageSize, total, params }: { page: number; pageSize: number; total: number; params: SearchParams }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1 && page === 1) return null;
  return <nav className={styles.nav} aria-label="Phân trang">
    <p>{total > 0 && page <= pages ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} trong ${total} tin` : `${total} tin`} · Trang {page}/{pages}</p>
    <div>
      {page > 1 && <Link href={searchUrl(params, Math.min(page - 1, pages))}>Trang trước</Link>}
      {page > pages && <Link href={searchUrl(params, 1)}>Về trang đầu</Link>}
      {page < pages && <Link href={searchUrl(params, page + 1)}>Trang sau</Link>}
    </div>
  </nav>;
}

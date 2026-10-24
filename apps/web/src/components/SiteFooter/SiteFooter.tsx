'use client';
import Link from 'next/link';
import { useDatasetHref } from '@/lib/useDatasetHref';
import { Logo } from '../Logo/Logo';
import styles from './SiteFooter.module.css';

export function SiteFooter({ account = null }: { account?: string | null }) {
  const scoped = useDatasetHref();
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Logo />
          <p>
            Đồ án TMG301 — trích xuất thông tin bất động sản từ bài đăng mạng xã hội. Số liệu là giá chào thuê trong bài đăng đã
            thu, không phải giá giao dịch.
          </p>
        </div>
        <nav className={styles.cols} aria-label="Liên kết cuối trang">
          <div>
            <h2>Người đi thuê</h2>
            <Link href={scoped('/tim-tro')}>Tìm trọ</Link>
            <Link href={scoped('/#nguyen-tac')}>Nguyên tắc dữ liệu</Link>
            <Link href={scoped('/#extension')}>Minh họa extension</Link>
          </div>
          <div>
            <h2>Dữ liệu</h2>
            <Link href="/tim-tro?demo=true">Bộ demo</Link>
            <Link href="/tim-tro?demo=false">Kho dữ liệu thật</Link>
            <Link href={scoped("/#cach-hoat-dong")}>Cách hoạt động</Link>
          </div>
          <div>
            <h2>Tài khoản</h2>
            {account ? (
              <>
                <Link href="/phan-tich">Phân tích bài đăng</Link>
                <Link href="/thi-truong">Thị trường</Link>
                <Link href="/tai-khoan">Tài khoản của tôi</Link>
              </>
            ) : (
              <>
                <Link href="/dang-nhap">Đăng nhập</Link>
                <Link href="/dang-ky">Tạo tài khoản</Link>
              </>
            )}
          </div>
        </nav>
      </div>
      <div className={`container ${styles.legal}`}>
        <span>
          Bài có nhãn “Ví dụ tự tạo” là bài minh họa. Kho tin và số liệu được đọc từ API; dữ liệu thật được che số điện thoại trước khi lưu.
        </span>
      </div>
    </footer>
  );
}

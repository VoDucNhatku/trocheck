'use client';

import Link from 'next/link';
import { Button } from '@/components/Button/Button';
import styles from './status.module.css';

export type StatusKind = 'not-found' | 'server-error' | 'expired';

const COPY = {
  'not-found': {
    code: '404', stamp: 'Không tìm thấy', title: 'Trang hoặc tin này không có.',
    description: 'Có thể đường dẫn đã đổi hoặc tin không còn trong kho. Bạn có thể quay lại Tìm trọ.',
  },
  'server-error': {
    code: '500', stamp: 'Đang gặp sự cố', title: 'Chưa thể mở trang này.',
    description: 'Đã có lỗi khi tải trang. Hãy thử lại sau ít phút. Nếu bạn vừa gửi dữ liệu, kiểm tra kết quả trước khi gửi lại.',
  },
  expired: {
    code: 'Cần đăng nhập lại', stamp: 'Hết phiên', title: 'Phiên đăng nhập đã hết hạn.',
    description: 'Đăng nhập lại để tiếp tục công việc của bạn.',
  },
} satisfies Record<StatusKind, { code: string; stamp: string; title: string; description: string }>;

export function StatusScreen({ kind, onRetry, loginHref = '/dang-nhap?state=expired&next=%2Fphan-tich' }: {
  kind: StatusKind;
  onRetry?: () => void;
  loginHref?: string;
}) {
  const copy = COPY[kind];
  return <div className={`container ${styles.page}`} data-status={kind}>
    <div className={styles.receipt} aria-hidden="true">
      <div className={styles.receiptHead}><b>Phiếu giá</b><span>Ví dụ</span></div>
      <div className={styles.emptyPrice}><span>Giá thuê</span><strong>—</strong></div>
      <span className={styles.stamp}>{copy.stamp}</span>
      <div className={styles.emptyRows}><span>Diện tích</span><span>Vị trí</span><span>Các khoản phí</span></div>
    </div>
    <section className={styles.copy} aria-labelledby="status-title">
      <p className={styles.eyebrow}>{copy.code}</p>
      <h1 id="status-title">{copy.title}</h1>
      <p className={styles.description}>{copy.description}</p>
      <div className={styles.actions}>
        {kind === 'server-error' ? <Button onClick={onRetry ?? (() => window.location.reload())}>Thử lại</Button>
          : kind === 'expired' ? <Link className={styles.primary} href={loginHref}>Đăng nhập lại</Link>
            : <Link className={styles.primary} href="/tim-tro">Về Tìm trọ</Link>}
        {kind !== 'expired' && <Link className={styles.secondary} href="/">Về trang chủ</Link>}
      </div>
    </section>
  </div>;
}

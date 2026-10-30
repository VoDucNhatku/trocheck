import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { requireUser } from '@/lib/workspace/server';
import { Intro } from '@/features/workspace/ui';
import s from '@/features/workspace/workspace.module.css';
import styles from './forbidden.module.css';

export const metadata = { title: '403 · Không đủ quyền' };

export default async function Page() {
  await requireUser('/team/403');
  return <section className={styles.layout} aria-label="Không đủ quyền vào khu nhóm">
    <div className={styles.illustration} aria-hidden="true">
      <div className={[s.panel, styles.sheet].join(' ')}>
        <div className={styles.sheetHeading}><strong>Phiếu giá</strong><span className={s.badge}>Ví dụ</span></div>
        <div className={styles.rent}><span>Giá thuê</span><strong>—</strong></div>
        <div className={styles.lock}><LockKeyhole size={20} /><strong>Không đủ quyền</strong></div>
        <div className={styles.fields}><span>Diện tích</span><span>Vị trí</span><span>Các khoản phí</span></div>
      </div>
    </div>
    <div className={styles.copy}>
      <p className={s.eyebrow}>403 · Khu nhóm</p>
      <Intro title="Bạn chưa có quyền vào khu này" description="Mỗi trang khu nhóm yêu cầu quyền phù hợp: thu thập, kiểm duyệt hoặc nghiên cứu. Liên hệ người quản trị nhóm để được cấp quyền." />
      <Link className={s.button} href="/phan-tich">Về bàn đọc tin</Link>
    </div>
  </section>;
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ExtensionFlow } from '@/features/landing/ExtensionFlow';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Extension · Tiện ích Chrome' };

const DOWNLOAD_URL = '/downloads/trocheck-collector.zip';

export default function ExtensionPage() {
  return <div className={`container ${styles.page}`}>
    <div className={styles.intro}>
      <header>
        <p className={styles.eyebrow}>Tiện ích Chrome</p>
        <h1>Lưu bài trọ ngay khi lướt Facebook.</h1>
        <p className={styles.lead}>TrọCheck Collector lưu các bài bạn cuộn qua trong nhóm Facebook, ngay trên máy bạn. Số điện thoại được che trước khi lưu.</p>
        <ol className={styles.steps}>
          <li>Mở một nhóm Facebook hoặc trang tìm kiếm rồi cuộn như bình thường.</li>
          <li>Mở bảng dữ liệu của extension để xem bài đã lưu, lọc bài cho thuê và tách thông tin.</li>
          <li>Khi muốn, bấm gửi về kho TrọCheck để nhóm duyệt và so giá.</li>
        </ol>
      </header>
      <aside className={styles.panel} aria-labelledby="install-title">
        <h2 id="install-title">Cách cài</h2>
        <ol className={styles.steps}>
          <li>Bấm nút tải bên dưới rồi giải nén file vừa tải.</li>
          <li><span>Mở <code>chrome://extensions</code> và bật Developer mode.</span></li>
          <li><span>Chọn Load unpacked rồi chọn thư mục <code>trocheck-collector</code>.</span></li>
        </ol>
        <div className={styles.actions}>
          <a className={styles.primary} href={DOWNLOAD_URL} download>Tải extension</a>
        </div>
      </aside>
    </div>
    <section className={styles.section} id="minh-hoa" aria-labelledby="flow-title">
      <header className={styles.sectionHead}><h2 id="flow-title">Một bài đi qua bốn bước.</h2></header>
      <ExtensionFlow />
    </section>
    <section className={`${styles.section} ${styles.split}`} aria-labelledby="connect-title">
      <h2 id="connect-title">Nối với tài khoản TrọCheck.</h2>
      <div className={styles.stack}>
        <p>Tạo token trong trang Tài khoản, rồi dán vào phần Cài đặt của extension. Tài khoản cần có quyền thu dữ liệu mới gửi được bài về kho.</p>
        <Link className={styles.primary} href="/tai-khoan">Tạo token</Link>
      </div>
    </section>
    <section className={`${styles.section} ${styles.split}`} aria-labelledby="limit-title">
      <h2 id="limit-title">Những điều cần biết.</h2>
      <ul className={styles.limits}>
        <li>Extension chỉ đọc bài đã hiện trên trang và tự bấm mở “Xem thêm”. Bài chưa mở hết chữ thì không được lưu.</li>
        <li>Bước lọc gửi nội dung tới TypeSafe, bước trích xuất gửi tới Ollama Cloud. Hai bước này cần API key của bạn và có thể mất phí.</li>
        <li>Kết quả lọc và trích xuất do model đưa ra nên có thể sai. Giao diện Facebook đổi thì extension có thể đọc thiếu.</li>
        <li>Extension chưa hiện nhận định giá ngay trên Facebook. Muốn kiểm tra giá một bài, hãy <Link href="/phan-tich">dán bài trên web</Link>.</li>
      </ul>
    </section>
  </div>;
}

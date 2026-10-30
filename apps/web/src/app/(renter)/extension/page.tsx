import type { Metadata } from 'next';
import Link from 'next/link';
import { ExtensionPreview } from '@/features/landing/LandingDemos';
import { AtomicText } from '@/features/landing/examples';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Extension · Tiện ích Chrome' };

export default function ExtensionPage() {
  return <div className={`container ${styles.page}`}>
    <div className={styles.intro}>
      <header>
        <p className={styles.eyebrow}>Tiện ích Chrome · Đang phát triển</p>
        <h1>Nhận định ngay<br /><em>trên Facebook.</em></h1>
        <p className={styles.lead}>Đọc một bài cho thuê mà không rời bảng tin. Bạn xem trước nội dung trước khi gửi.</p>
        <ol className={styles.steps}>
          <li>Bấm nút TrọCheck cạnh bài hoặc bôi đen đoạn chữ cần đọc.</li>
          <li>Xem trước chữ sẽ gửi. Kiểm tra tên người đăng và liên hệ đã che trước khi gửi.</li>
          <li><span><AtomicText text="Đọc riêng giá thuê, phí, đặt cọc và nhận định so với nhóm tương tự." /></span></li>
        </ol>
        <p className={styles.note}>Ba bước trên mô tả luồng dự kiến. Tiện ích chưa có bản cài đặt.</p>
      </header>
      <aside className={styles.panel} aria-labelledby="try-web-title">
        <span className={styles.badge}>Bản thử giao diện</span>
        <h2 id="try-web-title">Đọc thử trên web trước.</h2>
        <p>Extension chưa có bản cài đặt. Bạn vẫn có thể xem luồng đọc bài và bốn trạng thái bên dưới.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/phan-tich">Phân tích bài đăng</Link>
          <a className={styles.secondary} href="#minh-hoa">Xem minh họa</a>
        </div>
      </aside>
    </div>
    <section className={styles.section} id="minh-hoa" aria-labelledby="preview-title">
      <header className={styles.sectionHead}>
        <div><p className={styles.eyebrow}>Từ xem trước đến kết quả</p><h2 id="preview-title">Bạn biết chữ gì<br />được gửi đi.</h2></div>
        <span className={styles.badge}>Ví dụ tự tạo</span>
      </header>
      <ExtensionPreview />
    </section>
    <section className={styles.split} aria-labelledby="save-title">
      <div><p className={styles.eyebrow}>Tự lưu khi bạn cuộn · Dự kiến</p><h2 id="save-title">Chữ bài và ngữ cảnh.<br />Để xem lại khi cần.</h2></div>
      <div className={styles.stack}>
        <p>Luồng dự kiến cho nhóm vận hành: chủ động bật hoặc tắt việc lưu bài trong nhóm Facebook; xem số bài và bài trùng đã bỏ qua.</p>
        <p className={styles.note}>Chức năng này chưa có trên bản web. Không có bài hay ảnh nào được tự thu thập từ màn minh họa này.</p>
        <p className={styles.note}>Nếu Facebook yêu cầu xác minh, luồng dự kiến tạm dừng để bạn xử lý.</p>
      </div>
    </section>
    <section className={`${styles.section} ${styles.split}`} aria-labelledby="connect-title">
      <div><p className={styles.eyebrow}>Kết nối với tài khoản · Dự kiến</p><h2 id="connect-title">Một token cho<br />extension của bạn.</h2></div>
      <div className={styles.stack}>
        <p>Luồng dự kiến dùng token riêng để kết nối tiện ích với tài khoản TrọCheck. Bản hiện tại chưa hỗ trợ tạo token extension.</p>
        <p className={styles.badge}>Chưa có bản cài · Chưa kết nối token</p>
        <Link className={styles.primary} href="/phan-tich">Dán bài trên web</Link>
        <p className={styles.note}>Bạn có thể đăng nhập để dán chữ và phân tích bài thủ công trên web.</p>
      </div>
    </section>
    <p className={styles.note}><AtomicText text="Ví dụ tự tạo. Giá chào thuê trong bài đăng, không phải giá giao dịch. Chỉ đưa ra nhận định khi có đủ dữ liệu; giá thuê, phí và đặt cọc được giữ riêng." /></p>
  </div>;
}

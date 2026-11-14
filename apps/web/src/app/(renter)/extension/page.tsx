import type { Metadata } from 'next';
import Link from 'next/link';
import { ExtensionFlow } from '@/features/landing/ExtensionFlow';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Extension · Chrome và Microsoft Edge' };

const DOWNLOAD_URL = '/downloads/trocheck-collector.zip';

export default function ExtensionPage() {
  return <div className={`container ${styles.page}`}>
    <div className={styles.intro}>
      <header>
        <p className={styles.eyebrow}>Tiện ích Chrome và Microsoft Edge</p>
        <h1>Lưu bài trọ ngay khi lướt Facebook.</h1>
        <p className={styles.lead}>TrọCheck Collector lưu bài bạn cuộn qua trong nhóm và tìm kiếm bài viết Facebook. Sau khi kết nối, bài và ảnh được tự động gửi về kho TrọCheck, chữ được che số điện thoại trước. Bạn có thể tắt tự động gửi trong Cài đặt.</p>
      </header>
      <aside className={styles.panel} aria-labelledby="install-title">
        <h2 id="install-title">Cách cài</h2>
        <ol className={styles.steps}>
          <li><span><b>Tải và cài vào trình duyệt.</b>
            <span className={styles.sub}>Bấm “Tải extension” bên dưới rồi giải nén file <code>trocheck-collector.zip</code> thành một thư mục <code>trocheck-collector</code>, để ở nơi bạn không xóa.</span>
            <span className={styles.sub}>Mở <code>chrome://extensions</code> trên Chrome hoặc <code>edge://extensions</code> trên Microsoft Edge, bật Developer mode, chọn Load unpacked và chọn thư mục vừa giải nén. Hai trình duyệt dùng cùng các bước cài.</span>
            <span className={styles.sub}>Bấm biểu tượng ghép hình trên thanh công cụ và ghim TrọCheck Collector để dễ mở lại.</span></span></li>
          <li><span><b>Kết nối tài khoản.</b>
            <span className={styles.sub}>Vào <Link href="/tai-khoan">Tài khoản</Link>, đăng nhập và bấm “Kết nối extension trên trình duyệt này”. Không cần sao chép mã. Trang sẽ báo “Đã kết nối với extension” và danh sách kết nối hiện thêm một dòng.</span>
            <span className={styles.sub}>Nếu trang báo chưa tìm thấy extension, kiểm tra extension đang bật rồi tải lại trang Tài khoản.</span></span></li>
          <li><span><b>Mở Facebook và cuộn.</b>
            <span className={styles.sub}>Tìm “phòng trọ” kèm tên khu vực (ví dụ “phòng trọ Thủ Đức”) hoặc mở một nhóm cho thuê, rồi cuộn xuống. Nếu Facebook đã mở trước khi cài, tải lại trang đó một lần.</span>
            <span className={styles.sub}>Sau khi cuộn, quay lại <Link href="/bai-cua-toi">Bài của tôi</Link> để xem bài đã gửi, giá và khu vực đọc được.</span></span></li>
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
      <h2 id="connect-title">Kết nối tài khoản</h2>
      <div className={styles.stack}>
        <p>Kết nối một lần trên trình duyệt đang cài extension. Tài khoản nào đã đăng nhập cũng gửi được bài. Mỗi tài khoản có giới hạn số bài mới và số ảnh mỗi ngày; phần vượt giới hạn nằm lại trên máy và tự gửi tiếp vào hôm sau. Tạo mã rồi dán vào Cài đặt vẫn có sẵn để dùng khi cần.</p>
        <Link className={styles.primary} href="/tai-khoan">Kết nối extension</Link>
      </div>
    </section>
    <section className={`${styles.section} ${styles.split}`} aria-labelledby="limit-title">
      <h2 id="limit-title">Những điều cần biết.</h2>
      <ul className={styles.limits}>
        <li>Bảng tin trang chủ, trang cá nhân, Pages, Marketplace và Messenger không được lưu. Chỉ nhóm và tìm kiếm bài viết Facebook được thu thập.</li>
        <li>Extension chỉ đọc bài đã hiện trên trang và tự bấm mở “Xem thêm”. Bài chưa mở hết chữ thì không được lưu.</li>
        <li>Bước lọc gửi nội dung tới TypeSafe, bước trích xuất gửi tới Ollama Cloud. Hai bước này cần API key của bạn và có thể mất phí.</li>
        <li>Kết quả lọc và trích xuất do model đưa ra nên có thể sai. Giao diện Facebook đổi thì extension có thể đọc thiếu.</li>
        <li>Extension chưa hiện nhận định giá ngay trên Facebook. Muốn kiểm tra giá một bài, hãy <Link href="/phan-tich">dán bài trên web</Link>.</li>
      </ul>
    </section>
  </div>;
}

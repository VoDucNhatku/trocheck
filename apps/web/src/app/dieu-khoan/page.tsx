import type { Metadata } from 'next';
import Link from 'next/link';
import { Phrase } from '@/features/landing/examples';
import RenterLayout from '../(renter)/layout';
import styles from './terms.module.css';

export const metadata: Metadata = { title: 'Điều khoản và dữ liệu' };

const CONTENTS = [
  ['demo', 'TrọCheck là bản demo học tập'],
  ['price', 'Giá chào thuê, không phải giá giao dịch'],
  ['collection', 'Dữ liệu được thu thế nào'],
  ['mask', 'Liên hệ và tên người đăng'],
  ['images', 'Ảnh được lưu thế nào'],
  ['contribute', 'Đóng góp vào kho chung'],
  ['account', 'Tài khoản, email và Google'],
  ['contact', 'Liên hệ nhóm'],
] as const;

export default function TermsPage() {
  return <RenterLayout><div className={`container ${styles.page}`}>
    <header className={styles.heading}>
      <p className={styles.eyebrow}>Cập nhật 30/10/2026 · Đồ án học tập TMG301</p>
      <h1>Điều khoản<br /><span>và dữ liệu.</span></h1>
      <p className={styles.lead}>Chúng ta đọc điều gì, lưu điều gì, và điều gì chưa thể kết luận.</p>
    </header>
    <div className={styles.layout}>
      <nav className={styles.toc} aria-label="Mục lục điều khoản">
        {CONTENTS.map(([id, title], index) => <a key={id} href={'#' + id}><span className={styles.number}>{String(index + 1).padStart(2, '0')} /</span><span>{title}</span></a>)}
      </nav>
      <article className={styles.copy} aria-label="Điều khoản và dữ liệu">
        <section id="demo"><h2>TrọCheck là bản demo học tập</h2><p><strong>Đây là đồ án học tập TMG301.</strong> <Phrase>TrọCheck giúp đọc</Phrase> <Phrase>giá thuê</Phrase>, <Phrase>diện tích</Phrase>, vị trí, <Phrase>loại phòng</Phrase> và phí trong bài cho thuê. Bài có nhãn <mark>“Ví dụ tự tạo”</mark> là nội dung minh họa. Bộ demo và kho dữ liệu thật được xem riêng; số liệu demo không đại diện cho thị trường.</p></section>
        <section id="price"><h2>Giá chào thuê, không phải giá giao dịch</h2><p><strong>Mức giá phản ánh nội dung bài đăng.</strong> <Phrase>Giá thuê</Phrase>, phí và đặt cọc được tách riêng, không cộng thành tổng. So sánh dùng giá <Phrase>trung bình</Phrase> của các tin tương tự, cùng phường, <Phrase>loại phòng</Phrase>, khoảng <Phrase>diện tích</Phrase> và cách tính giá. Cần ít nhất 10 tin đủ điều kiện; chưa đủ thì không đưa ra nhận định. Trường bài không ghi được giữ là <mark><Phrase>“Không đề cập”</Phrase></mark>. Hãy xác minh thông tin với người đăng trước khi thuê.</p></section>
        <section id="collection"><h2>Dữ liệu được thu thế nào</h2><p><strong>Bạn kiểm tra chữ trước khi gửi phân tích.</strong> Luồng dán chữ đọc nội dung bạn gửi. Luồng ảnh hiện dùng chữ mẫu cho ảnh ví dụ; OCR thật chưa kết nối. Với ảnh riêng, bạn nhập lại và kiểm tra chữ trước khi gửi. Extension và bot thuộc luồng thu thập của nhóm vận hành; bản web không tự đọc tài khoản Facebook của bạn.</p></section>
        <section id="mask"><h2>Liên hệ và tên người đăng</h2><p><strong>Số điện thoại được thay bằng “[SĐT]”.</strong> Chữ gửi phân tích được che số điện thoại và email trên giao diện; máy chủ kiểm tra, che lại số điện thoại trước khi lưu. Giao diện công khai không hiển thị tên người đăng. Bạn vẫn cần kiểm tra và xóa tên riêng, địa chỉ liên hệ cùng thông tin riêng tư không cần thiết trước khi gửi; việc che tự động có thể bỏ sót.</p></section>
        <section id="images"><h2>Ảnh được lưu thế nào</h2><p><strong>Bản web hiện không gửi ảnh riêng lên máy chủ.</strong> Khi chọn ảnh chụp, giao diện chỉ kiểm tra loại và kích thước file; nội dung ảnh không được đọc, hiển thị hoặc tải lên. Chỉ phần chữ bạn đã kiểm tra được gửi đi. Ảnh phòng trên giao diện là khối giữ chỗ <mark>“Ảnh phòng (ví dụ)”</mark>; không dùng ảnh phòng thật.</p></section>
        <section id="contribute"><h2>Đóng góp vào kho chung</h2><p><strong>Bạn chủ động chọn đóng góp.</strong> Gửi một bài để phân tích không đồng nghĩa đã đóng góp bài đó vào kho công khai. Bạn chọn “Đóng góp” ở bản đọc nếu muốn gửi vào kho chung. Bài đóng góp có thể cần người duyệt; hãy kiểm tra phần liên hệ đã che trước khi gửi.</p></section>
        <section id="account"><h2>Tài khoản, email và Google</h2><p><strong>Email có thể dùng để yêu cầu đặt lại mật khẩu.</strong> Khi được cấp, link đặt lại chỉ dùng một lần và hết hạn sau 30 phút. Bản hiện tại chưa kết nối dịch vụ gửi email, nên yêu cầu trên giao diện chưa bảo đảm có thư được gửi. Tài khoản chưa gắn email cần liên hệ quản trị nhóm. Đăng nhập Google chưa kết nối.</p></section>
        <section id="contact"><h2>Liên hệ nhóm</h2><p><strong>Trao đổi với nhóm thực hiện đồ án TMG301.</strong> Nếu cần hỏi về dữ liệu hoặc tài khoản, liên hệ nhóm qua kênh lớp học đã thống nhất. Hiện chưa công bố địa chỉ hỗ trợ riêng.</p></section>
        <div className={styles.end}><Link href="/dang-ky">Về trang đăng ký</Link><a href="#main">Về đầu trang</a></div>
      </article>
    </div>
  </div></RenterLayout>;
}

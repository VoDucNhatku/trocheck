import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { AtomicText, ExamplePost, ExampleReceipt, ExampleComparison } from './examples';
import styles from './ReadingHero.module.css';

const STEPS = [
  ['Ảnh phòng để bạn xem. Giá nằm trong chữ.', 'Ảnh phòng không dùng để suy ra giá, diện tích hay tiện nghi.'],
  ['Bài đăng được đọc thành từng dòng.', 'Bài ví dụ được tách thành từng dòng chữ. Tên người đăng và liên hệ được ẩn trước khi lưu.'],
  ['Mỗi đoạn chữ có một lớp nhãn.', 'Giá, diện tích, vị trí, loại phòng và phí được tách riêng. Bài này không ghi diện tích: để “Không đề cập”, không đoán.'],
  ['Năm khoản phí, đứng riêng từng dòng.', 'Không cộng phí vào giá thuê. Giữ cách tính theo người, theo tháng và khoản chưa rõ kỳ như bài viết.'],
  ['Đặt cạnh những tin cùng phường.', 'Cùng loại phòng, cùng cách tính và khoảng diện tích. Bài thiếu diện tích chỉ so với nhóm rộng, có ghi rõ. Đủ 10 tin mới hiện giá trung bình.'],
  ['Trước khi nhắn chủ trọ, xem giá này đáng hỏi tiếp không.', 'Bài thiếu gì, phiếu giá ghi thiếu cái đó, kèm câu nên hỏi lại người đăng. Quyết định thuê là của bạn.'],
];

/** CSS scroll timelines enhance a complete, readable static document. */
export function ReadingHero({ demo }: { demo?: boolean }) {
  return <>
    <section className={styles.story} aria-labelledby="hero-title">
      <div className={styles.stage}>
        <div className={styles.scene} aria-hidden="true">
          <Image src="/images/rener-courtyard.png" alt="" fill priority sizes="100vw" className={styles.photo} />
          <div className={styles.shade} /><div className={styles.frame} />
        </div>
        <div className={`container ${styles.content}`}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Một nơi ở. Một khởi đầu.</p>
            <h1 id="hero-title"><AtomicText text={"Đọc đúng giá thuê."} /><br /><em>Tìm chốn an tâm.</em></h1>
            <p className={styles.lead}>Giữa hàng trăm bài đăng, tìm một căn phòng vừa ý bắt đầu từ những thông tin rõ ràng.</p>
            <div className={styles.actions}>
              <Link href={`/tim-tro${demo === undefined ? '' : `?demo=${demo}`}`} className={styles.primary}>Tìm phòng của bạn <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <a href="#doc-bai-dang" className={styles.secondary}>Đọc cùng TrọCheck <ArrowDown size={16} aria-hidden="true" /></a>
            </div>
            <p className={styles.credit}>Không gian minh họa bằng AI</p>
          </div>
          <div className={styles.walkthrough} id="doc-bai-dang">
            <div className={styles.chapters} id="cach-hoat-dong">
              {STEPS.map(([title, body], index) => <section key={title} className={styles.chapter} data-step={index + 1}>
                <p className={styles.stepNumber}>0{index + 1}</p><h2><AtomicText text={title} /></h2><p><AtomicText text={body} /></p>
              </section>)}
            </div>
            <div className={styles.objects}>
              <div className={styles.post}><ExamplePost /><div className={styles.placeholder}><span><AtomicText text="Ảnh phòng (ví dụ)" /></span></div></div>
              <div className={styles.receipt}><ExampleReceipt /></div>
              <div className={styles.comparison}><ExampleComparison /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <div className={styles.cloudway} aria-hidden="true"><div className={styles.sky}>
      <div className={styles.cloud} /><div className={styles.cloud} /><div className={styles.veil} />
    </div></div>
  </>;
}

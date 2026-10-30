'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Pause, Play } from 'lucide-react';
import { ExamplePost, ExampleReceipt, Phrase, AtomicText } from './examples';
import styles from './LandingDemos.module.css';

const CLIPS = [
  ['Phòng trọ Thủ Đức', 'hẻm 51 Lê Văn Việt, phòng 20m2 có gác lửng, 3tr3/th nha mn', '3.300.000 đ/tháng', '20 m² · Lê Văn Việt'],
  ['Ở ghép Hà Nội', 'P 2 ng ở giá 1tr6/ng/th, nước 80k/ng, wifi free', '1.600.000 đ/tháng/người', 'Nước 80.000 đ/người · wifi miễn phí'],
  ['Pass phòng sinh viên', 'e cần pass lại phòng gấp ạ, 2tr8/th, cọc 1 tháng, ib e', '2.800.000 đ/tháng', 'Cọc 1 tháng · diện tích không đề cập'],
  ['Căn hộ mini Đống Đa', 'CCMN 1n1k full nt ngõ 10 Tôn Thất Tùng, giá 6tr/th', '6.000.000 đ/tháng', '1 ngủ 1 khách · phí không đề cập'],
  ['Phòng trọ gần FPT', 'Phòng mới xây 25m2 gần ĐH FPT, giá ib nha', 'Bài không công khai giá', '25 m² · gần ĐH FPT'],
  ['Cho thuê Bình Thạnh', 'studio 30m2 ban công, 7tr5/th, dv 200k/ng, k chung chủ', '7.500.000 đ/tháng', 'Dịch vụ 200.000 đ/người'],
  ['Phòng trọ Cầu Giấy', 'giá từ 3tr/th tuỳ tầng, giờ giấc tự do', 'Từ 3.000.000 đ/tháng', 'Chưa so sánh · diện tích không đề cập'],
  ['Phòng gần Đại học', '#phongtro #CauGiay giá 4tr2/tháng · ib để xem phòng', '4.200.000 đ/tháng', 'Diện tích không đề cập'],
  ['Bài sinh viên', 'cần tìm phòng gần trường, Xem thêm… chưa rõ giá và phí', 'Chưa đủ chữ', 'Không suy ra vị trí từ “Xem thêm”'],
];

export function FeedRibbon() {
  const [paused, setPaused] = useState(false);
  return <section className={styles.feed} aria-labelledby="feed-title" data-paused={paused}>
    <header className={`container ${styles.feedHead}`}><div><h2 id="feed-title">Đọc được cả bài viết tắt, cả bài giấu giá.</h2><p>Các mẩu dưới đây là ví dụ tự tạo, viết giống bài trong các nhóm cho thuê.</p></div>
      <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}{paused ? 'Chạy tiếp' : 'Tạm dừng'}</button>
    </header>
    <div className={styles.lane}>{[false,true].map(copy => <div key={String(copy)} className={styles.track} aria-hidden={copy || undefined}>
      {CLIPS.map(([source,body,price,meta]) => <article key={source} className={styles.clip}><p className={styles.source}><AtomicText text={source} /> · Ví dụ</p><p><AtomicText text={body} /></p><div className={styles.output}><b><AtomicText text={price} /></b><p><AtomicText text={meta} /></p></div></article>)}
    </div>)}</div>
  </section>;
}

export function ExtensionPreview({ demo }: { demo?: boolean }) {
  const [panel, setPanel] = useState('Kết quả');
  return <div data-extension-preview>
    <div className={styles.controls} aria-label="Chọn trạng thái minh họa">{['Xem trước','Đang đọc','Kết quả','Chưa đủ dữ liệu'].map(label => <button type="button" key={label} aria-pressed={panel===label} onClick={() => setPanel(label)}>{label}</button>)}</div>
    <div className={styles.browser}><div className={styles.browserBar}>Facebook · Ví dụ extension TrọCheck</div><div className={styles.browserBody}>
      <ExamplePost />
      <section className={styles.panel} aria-label="Kết quả extension ví dụ" aria-live="polite">
        <p className={styles.source}>TrọCheck · Ví dụ tự tạo · Đang phát triển</p>
        {panel==='Xem trước' ? <><h3>Chữ sẽ được gửi đi</h3><p>Tên người đăng và liên hệ đã ẩn. Đây là màn minh họa, chưa gửi bài để phân tích.</p><Link href="/phan-tich" className={styles.link}>Đọc bài đăng của bạn →</Link></> : panel==='Đang đọc' ? <><h3>Đang đọc bài…</h3><p>Ví dụ trạng thái xử lý; không hiện phần trăm khi chưa biết tổng việc.</p></> : panel==='Chưa đủ dữ liệu' ? <><h3>Chưa đủ dữ liệu để nhận định</h3><p><AtomicText text={"Ví dụ: mới có 7 tin tương tự, cần ít nhất 10 tin. Chưa đưa ra giá trung bình."} /></p></> : <><ExampleReceipt /><p><AtomicText text={"Ví dụ: cao hơn mức trung bình khoảng "} /><Phrase>+14,6%</Phrase><AtomicText text={" của 12 tin cùng phường, cùng loại; chưa lọc diện tích."} /></p></>}
        <Link href={`/tim-tro${demo===undefined?'':`?demo=${demo}`}`} className={styles.link}>Tìm tin trong kho →</Link>
      </section>
    </div></div>
  </div>;
}

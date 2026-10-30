import type { ReactNode } from 'react';
import styles from './examples.module.css';

export function Phrase({ children }: { children: ReactNode }) { return <span className={styles.phrase} data-phrase>{children}</span>; }

export function AtomicText({ text }: { text: string }) {
  return text.split(/(\d[\d.,]*\s*(?:m²|triệu|tr|đ|%|tháng|người|k)(?![\p{L}\p{N}])(?:\/(?:tháng|người|kWh)(?:\/người)?)?|Cầu Giấy|ĐH FPT|Tăng Nhơn Phú|Thủ Đức|Lê Văn Việt|Hà Nội|Đống Đa|Tôn Thất Tùng|Bình Thạnh|thang máy|giá thuê|diện tích|không đề cập|tiện nghi|loại phòng|đặt cọc|theo người|theo tháng|trung bình|ảnh phòng|phiếu giá|bài gốc|vị trí|nội thất|khép kín|gác lửng|dịch vụ|điện hành lang)/giu)
    .map((part, index) => index % 2 ? <Phrase key={index}>{part}</Phrase> : part);
}

/** Labels take part in line layout so adjacent rows cannot cover them. */
export function Mark({ label, children }: { label: 'Giá' | 'Diện tích' | 'Vị trí' | 'Loại phòng' | 'Phí'; children: ReactNode }) {
  return <mark className={styles.mark} data-entity={label}><small>{label}</small><span>{children}</span></mark>;
}

export function ExamplePost() {
  return <article className={styles.post} aria-label="Bài đăng ví dụ tự tạo">
    <header><span className={styles.avatar} aria-hidden="true">T</span><div><b>Người đăng đã ẩn</b><p>Ví dụ tự tạo · Liên hệ đã ẩn</p></div></header>
    <p className={styles.excerpt}><Mark label="Loại phòng">PHÒNG</Mark> cho thuê tại <Mark label="Vị trí">Tăng Nhơn Phú</Mark>, giá <Mark label="Giá"><AtomicText text={"4,7 triệu/tháng"} /></Mark>.</p>
    <p className={styles.excerpt}>Điện <Mark label="Phí">3.500 đ/kWh</Mark>. Nước <Mark label="Phí">100.000 đ/người</Mark>. Internet <Mark label="Phí">100.000 đ/tháng</Mark><AtomicText text={". Dịch vụ "} /><Mark label="Phí">150.000 đ/người</Mark><AtomicText text={". Điện hành lang "} /><Mark label="Phí">50.000 đ</Mark>.</p>
    <p className={styles.note}><AtomicText text={"[Liên hệ đã ẩn] · Bài không đề cập diện tích."} /></p>
  </article>;
}

const RECEIPT = [
  ['Diện tích', 'Không đề cập'], ['Vị trí', 'Tăng Nhơn Phú'], ['Điện', '3.500 đ/kWh'],
  ['Nước', '100.000 đ/người'], ['Internet', '100.000 đ/tháng'], ['Dịch vụ', '150.000 đ/người'],
  ['Điện hành lang', '50.000 đ · chưa rõ kỳ'],
];

export function ExampleReceipt() {
  return <section className={styles.receipt} aria-label="Phiếu giá ví dụ">
    <header><b><AtomicText text={"Phiếu giá"} /></b><span>Ví dụ tự tạo</span></header>
    <div className={styles.price}><small><AtomicText text={"Giá thuê"} /></small><p><Phrase>4.700.000 đ</Phrase> <span>/tháng</span></p></div>
    <dl>{RECEIPT.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value.includes(' · ') ? <><Phrase>{value.split(' · ')[0]}</Phrase> · {value.split(' · ')[1]}</> : <Phrase>{value}</Phrase>}</dd></div>)}</dl>
    <p className={styles.note}><AtomicText text={"Nên hỏi lại: diện tích phòng, điện hành lang tính theo tháng hay theo người."} /></p>
  </section>;
}

export function ExampleComparison() {
  return <aside className={styles.comparison} aria-label="So sánh giá ví dụ">
    <p className={styles.note}><AtomicText text={"Ví dụ tự tạo · 12 tin cùng phường, cùng loại · chưa lọc diện tích"} /></p>
    <div className={styles.bars} aria-hidden="true">{[25,45,75,100,65,40,22].map((height,i) => <span key={i} style={{height:`${height}%`}} />)}</div>
    <div className={styles.compareNumbers}><p><AtomicText text={"Trung bình"} /><br /><b><Phrase>4.100.000 đ</Phrase></b></p><p>Tin ví dụ<br /><b><Phrase>4.700.000 đ</Phrase></b></p></div>
    <p className={styles.verdict}><AtomicText text={"Cao hơn mức trung bình khoảng "} /><Phrase>+14,6%</Phrase>.</p>
    <p className={styles.note}>Số minh họa, không phải thống kê kho. Đây là giá chào thuê, không phải giá giao dịch.</p>
  </aside>;
}

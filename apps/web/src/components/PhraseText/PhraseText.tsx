import styles from '../shared.module.css';

// Protect short domain phrases; leave the rest of a long sentence free to wrap.
const phrases = /(\d[\d.,]*\s*(?:đ|m²|tr|tháng(?: tiền thuê)?|%)|Cầu Giấy|Dịch Vọng Hậu|Mai Dịch|Hà Nội|thang máy|[Cc]hung cư mini|[Pp]hòng trọ|[Kk]hông đề cập)/gu;

export function PhraseText({ text }: { text: string }) {
  return text.split(phrases).map((part, index) => index % 2
    ? <span className={styles.phrase} key={index}>{part}</span>
    : part.split('/').map((fragment, unitIndex) => <span key={`${index}-${unitIndex}`}>{unitIndex > 0 && <><wbr />/</>}{fragment}</span>));
}

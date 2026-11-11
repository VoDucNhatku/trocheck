'use client';

import { useId, useRef, useState } from 'react';
import { motion, MotionConfig, type Variants } from 'motion/react';
import { Phrase } from './examples';
import { EASE, SideBlock, useScrollReveal } from './ScrollReveal';
import styles from './HardCases.module.css';

type Tone = 'price' | 'area' | 'room' | 'fee' | 'gap';
type QuotePart = string | { label: string; text: string; tone: Tone };
interface HardCase { title: string; quote: QuotePart[]; problem: string; solution: string; result: string[] }

const CASES: HardCase[] = [
  {
    title: 'Bài không ghi giá',
    quote: ['Phòng ', { label: 'Diện tích', text: '25m2', tone: 'area' }, ', ', { label: 'Không có số', text: 'giá ib nhé', tone: 'gap' }, '.'],
    problem: 'Muốn biết giá phải nhắn tin cho người đăng. Trong bài không có con số nào để đọc.',
    solution: 'Ghi rõ bài không công khai giá, không điền số 0 và không đoán một mức. Tin này không được tính vào giá trung bình.',
    result: ['Bài không công khai giá'],
  },
  {
    title: 'Giá tính theo người',
    quote: ['Phòng ', { label: 'Diện tích', text: '30m2', tone: 'area' }, ', ', { label: 'Giá', text: '2tr/người/tháng', tone: 'price' }, '.'],
    problem: '2 triệu một người khác hẳn 2 triệu một phòng, mà bài lại không nói phòng ở mấy người.',
    solution: 'Giữ nguyên cách tính theo người, không tự nhân lên. Tin này chỉ được so với các tin cũng tính theo người.',
    result: ['2 tr/tháng/người'],
  },
  {
    title: 'Giá “từ…”',
    quote: ['Phòng ', { label: 'Loại phòng', text: 'khép kín', tone: 'room' }, ', ', { label: 'Giá', text: 'từ 3tr/tháng', tone: 'price' }, '.'],
    problem: '“Từ 3 triệu” chỉ là mức thấp nhất. Căn phòng bạn hỏi có thể đắt hơn.',
    solution: 'Giữ đúng chữ “từ”. Đây chưa phải một mức giá cụ thể nên chưa được đưa vào nhóm so sánh.',
    result: ['Từ 3 tr/tháng'],
  },
  {
    title: 'Một bài, nhiều phòng',
    quote: ['P201 ', { label: 'Giá', text: '3tr8', tone: 'price' }, ', P302 ', { label: 'Giá', text: '4tr9', tone: 'price' }, '.'],
    problem: 'Hai phòng, hai giá. Gộp lại hay lấy số ở giữa thì phòng nào cũng sai giá.',
    solution: 'Tách thành hai tin. Mỗi phòng giữ đúng giá của mình.',
    result: ['P201: 3,8 tr', 'P302: 4,9 tr'],
  },
  {
    title: 'Tiền nhà đi kèm phí',
    quote: ['Giá ', { label: 'Giá', text: '3tr5', tone: 'price' }, ', ', { label: 'Phí', text: 'điện 3k5/số', tone: 'fee' }, '.'],
    problem: 'Tiền điện tùy mức dùng. Cộng vào tiền nhà sẽ ra một con số trông chắc chắn nhưng thực ra là đoán.',
    solution: 'Tách tiền thuê và từng khoản phí thành dòng riêng, không cộng thành tổng.',
    result: ['Giá thuê: 3,5 tr', 'Điện: 3.500 đ/số'],
  },
  {
    title: 'Giá đã bao điện nước',
    quote: ['Phòng trọ ', { label: 'Giá', text: '3tr bao điện nước', tone: 'price' }, '.'],
    problem: 'Cùng là 3 triệu, nhưng phòng này đã gồm tiền điện nước, còn nhiều phòng khác phải trả thêm. Chỉ nhìn con số thì dễ so sai.',
    solution: 'Giữ giá thuê là 3 triệu và báo rằng bài có khoản đã bao trong giá, để bạn đối chiếu lại đoạn giá gốc.',
    result: ['3 tr', 'Có khoản đã bao trong giá'],
  },
];

const rise: Variants = {
  hidden: { opacity: 0, y: 20, transition: { duration: 0 } },
  shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};
const sweep: Variants = {
  hidden: { backgroundSize: '0% 100%', color: 'var(--on-night)', transition: { duration: 0 } },
  shown: { backgroundSize: '100% 100%', color: 'var(--mk-ink)', transition: { duration: 0.45, delay: 0.4, ease: EASE } },
};

function Quote({ parts }: { parts: QuotePart[] }) {
  return <blockquote className={styles.quote}>
    {parts.map((part, index) => typeof part === 'string'
      ? <span key={index}>{part}</span>
      : <span key={index} className={styles.mark} data-tone={part.tone}>
          <small className={styles.tag}>{part.label}</small>
          {part.tone === 'gap'
            ? <span className={styles.ink}>{part.text}</span>
            : <motion.span className={styles.ink} variants={sweep}>{part.text}</motion.span>}
        </span>)}
  </blockquote>;
}

function CaseStudy({ item, index }: { item: HardCase; index: number }) {
  // On phones the two explanation cells fold behind a button; on wider screens they always show.
  const [open, setOpen] = useState(false);
  const details = useId();
  return <article className={styles.case} data-open={open}>
    <SideBlock side="left" className={styles.head}>
      <p className={styles.number}>{String(index + 1).padStart(2, '0')}</p>
      <h3 className={styles.title}>{item.title}</h3>
    </SideBlock>
    <SideBlock side="left" className={styles.column}>
      <div className={styles.cell}>
        <p className={styles.partLabel}>Bài viết</p>
        <Quote parts={item.quote} />
      </div>
      <div className={`${styles.cell} ${styles.detail}`} id={`${details}-problem`}>
        <p className={styles.partLabel}>Khó ở đâu</p>
        <p className={styles.text}>{item.problem}</p>
      </div>
    </SideBlock>
    <SideBlock side="right" className={styles.column}>
      <div className={`${styles.cell} ${styles.detail}`} id={`${details}-solution`}>
        <p className={`${styles.partLabel} ${styles.solutionLabel}`}>TrọCheck xử lý</p>
        <p className={`${styles.text} ${styles.solution}`}>{item.solution}</p>
      </div>
      <div className={styles.cell}>
        <p className={styles.partLabel}>Kết quả</p>
        <p className={styles.resultValue}>{item.result.map((value, i) => <span key={value}>{i > 0 && ' · '}<Phrase>{value}</Phrase></span>)}</p>
      </div>
    </SideBlock>
    <button type="button" className={styles.more} aria-expanded={open} aria-controls={`${details}-problem ${details}-solution`} onClick={() => setOpen(value => !value)}>
      {open ? 'Ẩn cách xử lý' : 'Xem cách xử lý'}
    </button>
  </article>;
}

export function HardCases() {
  const heading = useRef<HTMLDivElement>(null);
  const headingState = useScrollReveal(heading);
  return <MotionConfig reducedMotion="user">
    <section className={`section ${styles.root}`} id="hard-cases" data-react-section>
      <div className="wrap">
        <motion.div ref={heading} className={styles.intro} variants={rise} initial={false} animate={headingState}>
          <p className="eyebrow">Không phải bài nào cũng thẳng thắn</p>
          <h2 className={styles.lede}>Sáu kiểu bài dễ đọc nhầm, và cách TrọCheck xử lý từng kiểu.</h2>
          <p className={styles.note}>Các câu trích do nhóm tự viết để minh họa.</p>
        </motion.div>
        <div className={styles.cases}>
          {CASES.map((item, index) => <CaseStudy key={item.title} item={item} index={index} />)}
        </div>
      </div>
    </section>
  </MotionConfig>;
}

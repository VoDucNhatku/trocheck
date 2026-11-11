'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, MotionConfig, type Variants } from 'motion/react';
import { AtomicText } from './examples';
import { EASE, SideBlock, useScrollReveal } from './ScrollReveal';
import styles from './ExtensionFlow.module.css';

const STEPS = [
  { id: 'luu', label: 'Lưu bài', title: 'Lưu ngay trên máy bạn', rows: [
    ['Nhóm', 'Phòng trọ Cầu Giấy'],
    ['Nội dung', 'Đã lưu, số điện thoại đã che'],
    ['Link bài gốc', 'Có'],
    ['Ảnh', 'Tải về máy nếu bài có ảnh'],
  ] },
  { id: 'loc', label: 'Lọc', title: 'Giữ lại bài cho thuê', rows: [
    ['Rao cho thuê', 'Có'],
    ['Có giá thuê', 'Có'],
    ['Số căn', 'Một căn'],
  ] },
  { id: 'trich', label: 'Trích xuất', title: 'Tách thông tin trong bài', rows: [
    ['Loại phòng', 'Chung cư mini'],
    ['Khu vực', 'Cầu Giấy'],
    ['Giá thuê', '4.700.000 đ/tháng'],
    ['Diện tích', '30 m²'],
    ['Thông tin thêm', 'Có gác, WC riêng, điện 3,5k/số, nước 100k/người/tháng, cọc 1 tháng'],
  ] },
  { id: 'gui', label: 'Gửi về kho', title: 'Chỉ gửi khi bạn bấm', rows: [
    ['Có gửi', 'Chữ bài đã che số, link bài, tên nhóm'],
    ['Không gửi', 'Ảnh, tên người đăng'],
    ['Kết quả', 'Bài vào kho TrọCheck để nhóm duyệt'],
  ] },
] as const;

/** Parts of the post that the extraction step reads; everything else stays plain text. */
const POST = [
  'Mình còn ', { hit: 'chung cư mini' }, ' ở ', { hit: 'Cầu Giấy' }, ', gần điểm xe buýt. Diện tích ', { hit: '30 m²' },
  ', có gác, WC riêng. Giá ', { hit: '4,7 tr/tháng' }, '. Điện 3,5k/số, nước 100k/người/tháng. Cọc 1 tháng. Liên hệ [SĐT].',
] as const;

const swap: Variants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12 } },
};

export function ExtensionFlow() {
  const [active, setActive] = useState<(typeof STEPS)[number]['id']>('luu');
  const step = STEPS.find(item => item.id === active) ?? STEPS[0];
  return <MotionConfig reducedMotion="user">
    <div className={styles.tabs} role="group" aria-label="Các bước của extension">
      {STEPS.map(item => <button key={item.id} type="button" className={styles.tab} aria-pressed={active === item.id} onClick={() => setActive(item.id)}>{item.label}</button>)}
    </div>
    <div className={styles.frame} data-react-section>
      <SideBlock side="left" className={styles.pane}>
        <p className={styles.label}>Bài trên Facebook</p>
        <p className={styles.post}>{POST.map((part, index) => typeof part === 'string'
          ? <span key={index}>{part}</span>
          : <span key={index} className={styles.hit} data-on={active === 'trich'}>{part.hit}</span>)}</p>
      </SideBlock>
      <SideBlock side="right" className={styles.pane}>
        <p className={styles.label}>Extension làm gì</p>
        <div className={styles.result} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step.id} variants={swap} initial="enter" animate="center" exit="exit">
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <dl className={styles.rows}>{step.rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd><AtomicText text={value} /></dd></div>)}</dl>
            </motion.div>
          </AnimatePresence>
        </div>
      </SideBlock>
    </div>
  </MotionConfig>;
}

export function ExtensionSection() {
  const heading = useRef<HTMLDivElement>(null);
  const state = useScrollReveal(heading);
  return <section className="extension-band section" id="extension" data-react-section>
    <div className="wrap">
      <motion.div ref={heading} className={styles.intro} initial={false} animate={state === 'shown' ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }} transition={state === 'shown' ? { duration: 0.5, ease: EASE } : { duration: 0 }}>
        <div>
          <p className="eyebrow">Extension Chrome</p>
          <h2 className={styles.title}>Lưu bài trọ ngay khi lướt Facebook.</h2>
          <p className={styles.lead}>Cuộn nhóm Facebook như bình thường. Extension lưu bài trên máy bạn, che số điện thoại, rồi gửi về kho TrọCheck khi bạn bấm.</p>
        </div>
        <div className={styles.actions}><a className="btn btn-primary" href="/downloads/trocheck-collector.zip" download>Tải extension</a><Link className="btn" href="/extension">Xem cách cài</Link></div>
      </motion.div>
      <ExtensionFlow />
    </div>
  </section>;
}

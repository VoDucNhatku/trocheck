'use client';

import { type ReactNode } from 'react';
import { motion, MotionConfig, type Variants } from 'motion/react';
import styles from './auth.module.css';

const EASE = [0.16, 1, 0.3, 1] as const;

/** Room photos for the strip; replace with images from the data store when the API serves them. */
const ROOM_PHOTOS = [
  { src: '/images/phong-vi-du.jpg', alt: 'Phòng ngủ có giường đôi, tủ quần áo trắng và cửa ra ban công' },
];

const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  shown: (delay: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay } }),
};
const marks: Variants = { hidden: {}, shown: { transition: { delayChildren: 0.75, staggerChildren: 0.18 } } };
const sweep: Variants = {
  hidden: { backgroundSize: '0% 100%' },
  shown: { backgroundSize: '100% 100%', transition: { duration: 0.45, ease: EASE } },
};
const slideIn: Variants = {
  hidden: { opacity: 0, x: 48, rotate: 0 },
  shown: (rotate: number) => ({ opacity: 1, x: 0, rotate, transition: { duration: 0.8, ease: EASE, delay: 1.1 } }),
};
const rows: Variants = { hidden: {}, shown: { transition: { delayChildren: 1.7, staggerChildren: 0.08 } } };
const row: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

function Mark({ entity, children }: { entity: string; children: ReactNode }) {
  return <motion.mark data-entity={entity} variants={sweep}>{children}</motion.mark>;
}

type RoomImage = { src: string; alt: string };

/** A band of room photos that keeps moving. With one photo it slowly pans; with more it scrolls past like a reel. */
export function RoomStrip({ photos = ROOM_PHOTOS }: { photos?: RoomImage[] }) {
  if (photos.length < 2) {
    const photo = photos[0];
    return <motion.figure className={styles.strip} variants={rise} custom={0.2}>
      <motion.img src={photo.src} alt={photo.alt} width={600} height={400}
        animate={{ scale: [1.12, 1.02, 1.12], objectPosition: ['50% 30%', '50% 70%', '50% 30%'] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }} />
    </motion.figure>;
  }
  const reel = [...photos, ...photos];
  return <motion.figure className={styles.strip} variants={rise} custom={0.2}>
    <motion.div className={styles.reel} animate={{ x: ['0%', '-50%'] }} transition={{ duration: photos.length * 6, repeat: Infinity, ease: 'linear' }}>
      {reel.map((photo, i) => <img key={i} src={photo.src} alt={i < photos.length ? photo.alt : ''} aria-hidden={i >= photos.length} width={600} height={400} />)}
    </motion.div>
  </motion.figure>;
}

export function AuthShowcase() {
  return <MotionConfig reducedMotion="user">
    <motion.aside className={styles.aside} initial="hidden" animate="shown">
      <motion.p variants={rise}>Từ một bài đăng, đến những điều rõ ràng</motion.p>
      <motion.h2 variants={rise} custom={0.1}>Tiền nhà rõ.<br />Phí đứng riêng.</motion.h2>
      <RoomStrip />
      <div className={styles.stage}>
        <motion.div className={styles.paper} variants={rise} custom={0.3}>
          <span className={styles.tag}>Ví dụ tự tạo</span>
          <motion.p data-quote variants={marks}>Mình còn <Mark entity="room">chung cư mini</Mark> ở <Mark entity="location">Cầu Giấy</Mark>, gần điểm xe buýt.<br />Diện tích <Mark entity="area">30 m²</Mark>, có gác, WC riêng, nội thất cơ bản.<br />Giá <Mark entity="price">4,7 tr/tháng/phòng</Mark>. <Mark entity="fee">Điện 3,5k/số</Mark>, <Mark entity="fee">nước 100k/người/tháng</Mark>, <Mark entity="fee">internet miễn phí</Mark>.<br /><Mark entity="fee">Cọc 1 tháng tiền thuê</Mark>. Ngõ đi lại thoải mái, liên hệ [SĐT].</motion.p>
        </motion.div>
        <motion.section className={styles.receipt} aria-label="Phiếu đọc ví dụ" variants={slideIn} custom={-1.5}>
          <span className={styles.tag}>PHIẾU ĐỌC · VÍ DỤ</span>
          <strong>4,7 tr <small>/tháng</small></strong>
          <motion.dl variants={rows}>
            {[['Diện tích', '30 m²'], ['Loại phòng', 'Chung cư mini'], ['Vị trí', 'Cầu Giấy'], ['Điện', '3.500 đ/số'], ['Nước', '100.000 đ/người/tháng'], ['Internet', 'Miễn phí'], ['Đặt cọc', '1 tháng tiền thuê']]
              .map(([term, value]) => <motion.div key={term} variants={row}><dt>{term}</dt><dd>{value}</dd></motion.div>)}
          </motion.dl>
        </motion.section>
      </div>
    </motion.aside>
  </MotionConfig>;
}

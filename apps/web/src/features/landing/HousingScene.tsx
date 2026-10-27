'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUpRight, MapPin } from 'lucide-react';
import styles from './HousingScene.module.css';

/** Native scrolling: one pinned photograph, independent frame and flowing HTML.
 * No React renders per frame; the RAF sleeps when the scroll has settled. */
export function HousingScene({ demo }: { demo?: boolean }) {
  const root = useRef<HTMLElement>(null);
  const photograph = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const chapter = useRef<HTMLDivElement>(null);
  const runway = useRef<HTMLDivElement>(null);
  const clouds = useRef<HTMLDivElement>(null);
  const cloudLeft = useRef<HTMLDivElement>(null);
  const cloudRight = useRef<HTMLDivElement>(null);
  const cloudFront = useRef<HTMLDivElement>(null);
  const cloudVeil = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = root.current;
    const photo = photograph.current;
    const border = frame.current;
    const lastCopy = chapter.current;
    const exitSpace = runway.current;
    const cloudScene = clouds.current;
    const left = cloudLeft.current;
    const right = cloudRight.current;
    const front = cloudFront.current;
    const veil = cloudVeil.current;
    if (!section || !photo || !border || !lastCopy || !exitSpace || !cloudScene || !left || !right || !front || !veil) return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let progress = 0;
    let target = 0;
    let start = 0;
    let distance = 1;
    let cloudStart = 1;
    let cloudDistance = 1;
    let previousTime = 0;
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
    const paint = () => {
      photo.style.transform = `translate3d(0, ${-progress * 3}%, 0) scale(${1.13 - progress * .1})`;
      border.style.transform = `translate3d(0, ${progress * 18}px, 0) scale(${1 - progress * .025})`;
      // The last block clears the header before clouds take over, as in the reference.
      const cloud = clamp((progress * distance - cloudStart) / cloudDistance);
      const near = smooth((cloud - .12) / .88);
      cloudScene.style.opacity = String(smooth(cloud / .22));
      left.style.transform = `translate3d(${-65 + cloud * 65}%, ${25 - cloud * 50}%, 0) rotate(18deg)`;
      right.style.transform = `translate3d(${65 - near * 65}%, ${20 - near * 55}%, 0) rotate(-18deg) scaleX(-1)`;
      front.style.transform = `translate3d(0, ${70 - smooth((cloud - .2) / .8) * 110}%, 0) scale(1.25)`;
      veil.style.opacity = String(smooth((cloud - .68) / .32));
    };
    const tick = (time: number) => {
      const delta = previousTime ? Math.min(time - previousTime, 64) : 16.7;
      previousTime = time;
      progress += (target - progress) * (1 - Math.exp(-delta / 90));
      if (Math.abs(target - progress) < .0002) progress = target;
      paint();
      raf = progress === target ? 0 : requestAnimationFrame(tick);
      if (!raf) previousTime = 0;
    };
    const update = () => {
      if (preference.matches) return;
      target = Math.max(0, Math.min(1, (scrollY - start) / distance));
      if (!raf && target !== progress) raf = requestAnimationFrame(tick);
    };
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      previousTime = 0;
      if (preference.matches) {
        delete section.dataset.sceneMotion;
        photo.style.removeProperty('transform');
        border.style.removeProperty('transform');
        exitSpace.style.removeProperty('height');
        cloudScene.style.opacity = '0';
        for (const layer of [left, right, front]) layer.style.removeProperty('transform');
        veil.style.removeProperty('opacity');
        return;
      }
      section.dataset.sceneMotion = 'on';
      start = section.getBoundingClientRect().top + scrollY;
      const viewport = photo.parentElement!;
      const header = parseFloat(getComputedStyle(viewport).top) || 0;
      const lastBottom = lastCopy.getBoundingClientRect().bottom + scrollY - start;
      cloudStart = Math.max(0, lastBottom - header);
      cloudDistance = viewport.offsetHeight * .75;
      distance = cloudStart + cloudDistance;
      const contentHeight = section.offsetHeight - exitSpace.offsetHeight;
      const requiredHeight = lastBottom + cloudDistance + viewport.offsetHeight;
      const exitHeight = Math.max(0, Math.round(requiredHeight - contentHeight));
      if (Math.abs(exitSpace.offsetHeight - exitHeight) > 1) exitSpace.style.height = `${exitHeight}px`;
      target = progress = Math.max(0, Math.min(1, (scrollY - start) / distance));
      paint();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    observer.observe(lastCopy);
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', measure);
    preference.addEventListener('change', measure);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      removeEventListener('scroll', update);
      removeEventListener('resize', measure);
      preference.removeEventListener('change', measure);
    };
  }, []);

  return (
    <section ref={root} className={styles.track} aria-labelledby="hero-title" data-housing-scene>
      <div className={styles.viewport} aria-hidden="true">
        <div className={styles.photograph} ref={photograph} data-scene-photo>
          <Image src="/images/rener-courtyard.png" alt="" fill priority sizes="(max-width: 760px) 1600px, 100vw" quality={85} className={styles.image} />
        </div>
        <div className={styles.shade} />
        <div className={styles.frame} ref={frame} />
        <div ref={clouds} className={styles.clouds} data-scene-clouds>
          <div ref={cloudLeft} className={styles.cloudLayer}>
            <Image src="/images/rener-cloud-bank.png" alt="" fill sizes="(max-width: 760px) 1200px, 1600px" quality={85} className={styles.cloudImage} />
          </div>
          <div ref={cloudRight} className={styles.cloudLayer}>
            <Image src="/images/rener-cloud-bank.png" alt="" fill sizes="(max-width: 760px) 1200px, 1600px" quality={85} className={styles.cloudImage} />
          </div>
          <div ref={cloudFront} className={`${styles.cloudLayer} ${styles.cloudFront}`}>
            <Image src="/images/rener-cloud-bank.png" alt="" fill sizes="(max-width: 760px) 1200px, 1600px" quality={85} className={styles.cloudImage} />
          </div>
          <div ref={cloudVeil} className={styles.cloudVeil} data-cloud-veil />
        </div>
      </div>

      <div className={styles.story}>
        <div className={`container ${styles.arrival}`}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}><span /> MỘT NƠI Ở. MỘT KHỞI ĐẦU.</p>
            <h1 id="hero-title" className={styles.title}>Đọc đúng giá thuê.<br /><em>Tìm chốn an tâm.</em></h1>
            <p className={styles.lead}>Giữa hàng trăm bài đăng, tìm một căn phòng vừa ý bắt đầu từ những thông tin rõ ràng.</p>
            <div className={styles.actions}>
              <Link href={`/tim-tro${demo === undefined ? '' : `?demo=${demo}`}`} className={styles.primary}>Tìm phòng của bạn <ArrowUpRight size={19} aria-hidden="true" /></Link>
              <a href="#doc-bai-dang" className={styles.secondary}>Khám phá ReNER <ArrowDown size={16} aria-hidden="true" /></a>
            </div>
          </div>
          <div className={styles.caption}>
            <a href="#doc-bai-dang" className={styles.scrollLink}><span className={styles.scrollCircle}><ArrowDown size={18} aria-hidden="true" /></span> Cuộn để đọc rõ hơn</a>
            <span className={styles.imageCredit}><MapPin size={13} aria-hidden="true" /> Không gian minh họa bằng AI</span>
          </div>
        </div>

        <div className={`container ${styles.chapter}`}>
          <div ref={chapter} className={styles.chapterCopy} data-scene-last-copy>
            <p className={styles.eyebrow}>SAU MỖI CÁNH CỬA, LÀ MỘT LỰA CHỌN.</p>
            <h2>Phòng hợp ý.<br /><em>Giá phải rõ.</em></h2>
            <p>ReNER đọc bài cho thuê trên Facebook, tách giá thuê khỏi tiền điện, nước và cọc. Bạn có thêm cơ sở để hỏi đúng, so sánh đúng.</p>
            <div className={styles.promises}><span>Giá thuê rõ ràng</span><span>Phí để riêng</span><span>Có chữ làm chứng</span></div>
          </div>
        </div>
        <div ref={runway} className={styles.cloudRunway} aria-hidden="true" />
      </div>
    </section>
  );
}

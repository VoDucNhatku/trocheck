'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { MARKUP_AFTER_CASES, MARKUP_AFTER_LOWER, MARKUP_BEFORE_CASES, MARKUP_BEFORE_LOWER } from './prototypeMarkup';
import { ExtensionSection } from './ExtensionFlow';
import { HardCases } from './HardCases';
import { protectLandingPhrases } from './landing-phrases';
import './prototype.css';
import './port-accessibility.css';

/** The authored prototype DOM stays intact so its CSS timelines share the same targets. */
export function PrototypeLanding({ demo, market }: { demo?: boolean; market?: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    protectLandingPhrases(root);
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const feed = root.querySelector<HTMLElement>('#feed');
    const pause = root.querySelector<HTMLButtonElement>('#pause');
    pause?.addEventListener('click', () => {
      if (!feed) return;
      const paused = feed.dataset.paused !== 'true';
      feed.dataset.paused = String(paused);
      pause.setAttribute('aria-pressed', String(paused));
      pause.querySelector('span')!.textContent = paused ? 'Chạy tiếp' : 'Tạm dừng';
      pause.querySelector('svg')!.innerHTML = paused ? '<path d="M4 2.5v11l9-5.5z"/>' : '<rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/>';
    }, options);

    root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => {
      const url = new URL(link.href);
      if (demo !== undefined && ['/tim-tro', '/thi-truong'].includes(url.pathname)) {
        url.searchParams.set('demo', String(demo));
        link.href = url.pathname + url.search + url.hash;
      }
    });

    const tilt = root.querySelector<HTMLElement>('#tilt');
    const content = root.querySelector<HTMLElement>('#ctn');
    const textLayer = root.querySelector<HTMLElement>('.txt .l1');
    const measure = () => tilt?.style.setProperty('--txth', `${textLayer?.offsetHeight || 400}px`);
    const resize = new ResizeObserver(measure);
    if (textLayer) resize.observe(textLayer);
    measure();
    if (matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches) {
      content?.addEventListener('pointermove', event => {
        const rect = content.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        tilt?.style.setProperty('--tx', `${x * 14}deg`); tilt?.style.setProperty('--ty', `${-y * 10}deg`);
        tilt?.style.setProperty('--gx', `${50 + x * 90}%`); tilt?.style.setProperty('--gy', `${50 + y * 90}%`);
      }, options);
      content?.addEventListener('pointerleave', () => { tilt?.style.setProperty('--tx', '0deg'); tilt?.style.setProperty('--ty', '0deg'); }, options);
    }

    const frames = new Set<number>();
    const counters = root.querySelectorAll<HTMLElement>('#stat-total, #stat-eligible');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const element = entry.target as HTMLElement;
        const value = Number(element.dataset.count);
        if (matchMedia('(prefers-reduced-motion:reduce)').matches) { element.textContent = value.toLocaleString('vi-VN'); continue; }
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / 700);
          element.textContent = Math.round(value * (1 - Math.pow(1 - progress, 3))).toLocaleString('vi-VN');
          if (progress < 1) { const frame = requestAnimationFrame(next => { frames.delete(frame); tick(next); }); frames.add(frame); }
        };
        tick(start);
      }
    }, { threshold: .3 });
    counters.forEach(counter => { counter.dataset.count = counter.textContent || '0'; observer.observe(counter); });
    return () => { controller.abort(); resize.disconnect(); observer.disconnect(); frames.forEach(cancelAnimationFrame); };
  }, [demo]);
  return <div ref={container} className="landing-prototype">
    <Markup html={MARKUP_BEFORE_LOWER} />
    <div className="home-lower">
      <Markup html={MARKUP_BEFORE_CASES} />
      <HardCases />
      <ExtensionSection />
      {market}
      <Markup html={MARKUP_AFTER_CASES} />
    </div>
    <Markup html={MARKUP_AFTER_LOWER} />
  </div>;
}

function Markup({ html }: { html: string }) {
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />;
}

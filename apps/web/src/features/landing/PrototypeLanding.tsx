'use client';

import { useEffect, useRef } from 'react';
import { EXTENSION_PANELS, PROTOTYPE_MARKUP } from './prototypeMarkup';
import { protectLandingPhrases } from './landing-phrases';
import './prototype.css';
import './port-accessibility.css';

type Panel = keyof typeof EXTENSION_PANELS;
const EXAMPLE_TEXT = 'Cho thuê CCMN 30m2 gần ĐH FPT. Giá 5tr5/tháng. Nước 100k/người. Liên hệ [SĐT].';

/** The authored prototype DOM stays intact so its CSS timelines share the same targets. */
export function PrototypeLanding({ demo }: { demo?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    protectLandingPhrases(root);
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const timers = new Set<ReturnType<typeof setTimeout>>();
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

    const extension = root.querySelector<HTMLElement>('[data-extension-demo]');
    let selected: Panel = 'preview';
    const selectPanel = (panel: Panel) => {
      selected = panel;
      const output = extension?.querySelector('[data-ext-output]');
      if (output) { output.innerHTML = EXTENSION_PANELS[panel]; protectLandingPhrases(output as HTMLElement); }
      extension?.querySelectorAll<HTMLElement>('.tabs [data-ext-state]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.extState === panel)));
    };
    extension?.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-ext-state]');
      const panel = button?.dataset.extState as Panel | undefined;
      if (!panel || !Object.hasOwn(EXTENSION_PANELS, panel)) return;
      selectPanel(panel);
      if (panel === 'loading') {
        // This explicitly labeled extension demo mirrors the prototype's three states.
        const timer = setTimeout(() => { timers.delete(timer); if (selected === 'loading') selectPanel('result'); }, 1800);
        timers.add(timer);
      }
    }, options);

    const analyze = root.querySelector<HTMLButtonElement>('[data-run-example]');
    const status = root.querySelector<HTMLElement>('[data-analysis-status]');
    analyze?.addEventListener('click', async () => {
      if (!status || analyze.disabled) return;
      analyze.disabled = true;
      analyze.setAttribute('aria-busy', 'true');
      status.textContent = 'Đang gửi bài ví dụ để phân tích…';
      try {
        const response = await fetch('/api/workspace/analyses', {
          method: 'POST', credentials: 'same-origin', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'X-ReNER-Request': '1' },
          body: JSON.stringify({ idempotency_key: 'landing-example:' + crypto.randomUUID(), source_type: 'fixture', text: EXAMPLE_TEXT, text_complete: true, phone_masked: true }),
        });
        const body = await response.json().catch(() => null);
        if (response.status === 401) {
          status.textContent = 'Đăng nhập để phân tích bài ví dụ. ';
          const link = document.createElement('a');
          link.href = '/dang-nhap?next=%2F%23extract-check'; link.textContent = 'Đăng nhập'; status.append(link);
        } else if (!response.ok) {
          status.textContent = body?.error?.message || 'Chưa phân tích được bài ví dụ. Hãy thử lại.';
        } else if (typeof body?.analysis_id === 'string') {
          status.textContent = 'Đã tiếp nhận bài ví dụ. ';
          const link = document.createElement('a');
          link.href = '/phan-tich/' + encodeURIComponent(body.analysis_id); link.textContent = 'Mở bản đọc'; status.append(link);
        } else status.textContent = 'Máy chủ chưa trả mã bản đọc. Hãy thử lại.';
      } catch (error) {
        if (!controller.signal.aborted) status.textContent = 'Không kết nối được máy chủ. Hãy thử lại.';
      } finally {
        analyze.disabled = false; analyze.removeAttribute('aria-busy');
      }
    }, options);

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
    return () => { controller.abort(); resize.disconnect(); observer.disconnect(); timers.forEach(clearTimeout); frames.forEach(cancelAnimationFrame); };
  }, [demo]);
  return <div ref={container} className="landing-prototype" dangerouslySetInnerHTML={{ __html: PROTOTYPE_MARKUP }} />;
}

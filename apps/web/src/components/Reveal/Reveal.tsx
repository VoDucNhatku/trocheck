'use client';

import { useLayoutEffect, useRef } from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'ul' | 'ol';
  /** Seconds between children entering together. */
  stagger?: number;
  id?: string;
  'aria-labelledby'?: string;
}

/**
 * Fades/rises every `[data-reveal]` descendant as it scrolls into view (ScrollTrigger.batch).
 * Content is visible by default; motion is only added when the user allows it.
 */
export function Reveal({ children, className, as: Tag = 'div', stagger = 0.08, ...rest }: Props) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    let revert: (() => void) | undefined;
    let cancelled = false;
    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const items = root.querySelectorAll<HTMLElement>('[data-reveal]');
        // Items already on screen at load stay put — no motion for content the user is reading.
        const below = Array.from(items).filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92);
        // Never gate content visibility on a scroll callback (screenshots, hidden tabs, JS errors).
        gsap.set(below, { y: 12 });
        ScrollTrigger.batch(below, {
          start: 'top 88%',
          once: true,
          onEnter: (batch) => gsap.to(batch, { y: 0, duration: 0.3, ease: 'power3.out', stagger }),
        });
      });
      revert = () => mm.revert();
    });
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [stagger]);

  return (
    <Tag ref={ref as React.Ref<never>} className={className} {...rest}>
      {children}
    </Tag>
  );
}

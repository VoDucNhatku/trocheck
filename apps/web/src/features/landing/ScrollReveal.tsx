'use client';

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { motion, useInView, type Variants } from 'motion/react';

export const EASE = [0.16, 1, 0.3, 1] as const;

type Side = 'left' | 'right';

/** The left block arrives first, then the right block follows from its own side. */
const fromSide: Variants = {
  hidden: (side: Side) => ({ opacity: 0, x: side === 'left' ? -64 : 64, transition: { duration: 0 } }),
  shown: (side: Side) => ({ opacity: 1, x: 0, transition: { duration: 0.65, ease: EASE, delay: side === 'left' ? 0 : 0.2 } }),
};

/** Content stays visible by default; only blocks below the fold wait for scroll, and only once JavaScript runs. */
export function useScrollReveal(ref: RefObject<HTMLElement | null>) {
  const seen = useInView(ref, { once: true, margin: '0px 0px -18% 0px' });
  const [armed, setArmed] = useState(false);
  useLayoutEffect(() => {
    const top = ref.current?.getBoundingClientRect().top ?? 0;
    if (top > window.innerHeight * 0.82 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setArmed(true);
  }, [ref]);
  return armed && !seen ? 'hidden' : 'shown';
}

export function SideBlock({ side, className, children }: { side: Side; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useScrollReveal(ref);
  return <motion.div ref={ref} className={className} custom={side} variants={fromSide} initial={false} animate={state}>{children}</motion.div>;
}

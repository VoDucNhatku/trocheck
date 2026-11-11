'use client';

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { motion, useInView, type Variants } from 'motion/react';

export const EASE = [0.16, 1, 0.3, 1] as const;

type Side = 'left' | 'right';
type Motion = { side: Side; narrow: boolean };

/** The left block arrives first, then the right block follows from its own side.
    On phones the columns stack, so both rise a little instead of sliding across a fifth of the screen. */
const fromSide: Variants = {
  hidden: ({ side, narrow }: Motion) => ({ opacity: 0, x: narrow ? 0 : side === 'left' ? -64 : 64, y: narrow ? 16 : 0, transition: { duration: 0 } }),
  shown: ({ side, narrow }: Motion) => ({ opacity: 1, x: 0, y: 0, transition: { duration: narrow ? 0.45 : 0.65, ease: EASE, delay: side === 'left' || narrow ? 0 : 0.2 } }),
};

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => setNarrow(window.matchMedia('(max-width: 860px)').matches), []);
  return narrow;
}

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
  const narrow = useNarrow();
  return <motion.div ref={ref} className={className} custom={{ side, narrow }} variants={fromSide} initial={false} animate={state}>{children}</motion.div>;
}

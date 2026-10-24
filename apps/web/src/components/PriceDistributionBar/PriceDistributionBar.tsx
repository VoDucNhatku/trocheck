'use client';

import { useEffect, useRef, useState } from 'react';
import type { Comparison } from '@/lib/api/types';
import { REASON_TEXT, formatShort } from '@/lib/format';
import styles from './PriceDistributionBar.module.css';

interface Props {
  comparison: Comparison;
  /** Rent of this listing as returned by the API; null when it has no exact price. */
  targetRent: number | null;
  compact?: boolean;
}

/**
 * P25 – median – P75 bar with a "tin này" marker. Draws numbers only when status = ok;
 * otherwise it keeps its place and explains why (spec 3.3, vùng So sánh).
 */
export function PriceDistributionBar({ comparison: c, targetRent, compact }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (c.status !== 'ok' || c.median == null || c.p25 == null || c.p75 == null) {
    return (
      <div className={styles.empty} role="note">
        <div className={styles.emptyTrack} aria-hidden="true">
          <span />
        </div>
        <ul className={styles.reasons}>
          {c.reason_codes.map((r) => (
            <li key={r}>{REASON_TEXT[r]}</li>
          ))}
        </ul>
        <p className={styles.emptyN}>
          N = <span className="num">{c.n}</span> tin trong nhóm tương tự
        </p>
      </div>
    );
  }

  // Scale for drawing only: span the quartiles, the target and the similar listings.
  const points = [
    c.p25,
    c.p75,
    c.median,
    ...(targetRent != null ? [targetRent] : []),
    ...c.similar.map((s) => s.rent_vnd),
  ];
  const lo = Math.min(...points) * 0.88;
  const hi = Math.max(...points) * 1.08;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;

  return (
    <div ref={ref} className={[styles.wrap, compact ? styles.compact : '', shown ? styles.shown : ''].join(' ')}>
      <div
        className={styles.track}
        role="img"
        aria-label={`Khoảng giữa P25 ${formatShort(c.p25)} đến P75 ${formatShort(c.p75)}, trung vị ${formatShort(c.median)}${
          targetRent != null ? `, tin này ${formatShort(targetRent)}` : ''
        }.`}
      >
        {targetRent != null && (
          <span
            className={styles.targetLabel}
            style={{ left: `${Math.max(22, Math.min(78, parseFloat(pos(targetRent))))}%` }}
          >
            Tin này · {formatShort(targetRent)}
          </span>
        )}
        <div className={styles.axis} />
        <div className={styles.iqr} style={{ left: pos(c.p25), width: `calc(${pos(c.p75)} - ${pos(c.p25)})` }} />
        <div className={styles.median} style={{ left: pos(c.median) }} />
        {c.similar.map((s) => (
          <span key={s.listing_id} className={styles.peer} style={{ left: pos(s.rent_vnd) }} />
        ))}
        {targetRent != null && (
          <div className={styles.target} style={{ left: pos(targetRent) }}>
            <span className={styles.targetDot} />
          </div>
        )}
      </div>
      <dl className={styles.legend}>
        <div>
          <dt>
            <span className={styles.swIqr} aria-hidden="true" />
            P25–P75
          </dt>
          <dd className="num">
            {formatShort(c.p25)} – {formatShort(c.p75)}
          </dd>
        </div>
        <div>
          <dt>
            <span className={styles.swMedian} aria-hidden="true" />
            Trung vị
          </dt>
          <dd className="num">{formatShort(c.median)}</dd>
        </div>
        {c.similar.length > 0 && (
          <div>
            <dt>
              <span className={styles.swPeer} aria-hidden="true" />
              Tin giống nhất
            </dt>
            <dd className="num">{c.similar.length}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

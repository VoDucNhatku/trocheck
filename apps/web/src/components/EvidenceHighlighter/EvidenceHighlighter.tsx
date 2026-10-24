'use client';

import type { Evidence } from '@/lib/api/types';
import { LABEL_NAME, LABEL_TEXT } from '@/lib/format';
import styles from './EvidenceHighlighter.module.css';

import { evidenceKey, segment } from '@/lib/evidence';
export { evidenceKey, segment } from '@/lib/evidence';

interface Props {
  text: string;
  evidence: Evidence[];
  /** Keys (start-end) to emphasise, e.g. the field the user clicked. */
  active?: Set<string>;
  onSelect?: (e: Evidence) => void;
  /** Show the method/rule beside the label (Lab view). */
  showRule?: boolean;
  /** Mark spans that differ from a reference row (Lab view). */
  mismatched?: Set<string>;
  size?: 'md' | 'lg';
  className?: string;
}

export function EvidenceHighlighter({ text, evidence, active, onSelect, showRule, mismatched, size = 'md', className }: Props) {
  const parts = segment(text, evidence);
  const anyActive = !!active && active.size > 0;
  return (
    <p className={[styles.text, styles[size], anyActive ? styles.dimmed : '', className].filter(Boolean).join(' ')}>
      {parts.map((p, i) => {
        if (!p.span) return <span key={i}>{p.text}</span>;
        const key = evidenceKey(p.span);
        const isActive = active?.has(key);
        const isMismatch = mismatched?.has(key);
        const label = LABEL_TEXT[p.span.label];
        const content = (
          <>
            <span className={styles.tag} aria-hidden="true">
              {label}
              {showRule && p.span.rule_id ? <span className={styles.rule}> · {p.span.rule_id}</span> : null}
            </span>
            <span className="visually-hidden">{LABEL_NAME[p.span.label]}: </span>
            {p.text}
          </>
        );
        const cls = [styles.mark, styles[p.span.label], isActive ? styles.active : '', isMismatch ? styles.mismatch : '']
          .filter(Boolean)
          .join(' ');
        return onSelect ? (
          <button key={i} type="button" className={cls} data-label={p.span.label} onClick={() => onSelect(p.span!)} aria-pressed={isActive}>
            {content}
          </button>
        ) : (
          <mark key={i} className={cls} data-label={p.span.label} data-key={key}>
            {content}
          </mark>
        );
      })}
    </p>
  );
}

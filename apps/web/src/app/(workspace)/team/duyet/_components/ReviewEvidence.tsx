'use client';

import { useState } from 'react';
import type { Evidence } from '@/lib/api/types';
import { evidenceKey, segment } from '@/lib/evidence';
import { LABEL_TEXT, LABEL_NAME } from '@/lib/format';
import { Phrases } from './display';
import styles from './review.module.css';

export function ReviewEvidence({ text, evidence, active, onSelect }: {
  text: string; evidence: Evidence[]; active: Set<string>; onSelect: (span: Evidence) => void;
}) {
  const [method, setMethod] = useState('all');
  const visible = method === 'all' ? evidence : evidence.filter(span => span.method === method);
  const mismatches = evidence.filter(span => evidence.some(other => other.start === span.start && other.end === span.end && other.label !== span.label));
  return <>
    <div className={styles.modeBar} aria-label="Phương pháp hiển thị">{[['regex', 'Regex'], ['llm', 'LLM'], ['all', 'Cả hai']].map(([key, name]) => <button type="button" key={key} className={styles.chip} aria-pressed={method === key} onClick={() => setMethod(key)}>{name}</button>)}</div>
    {visible.length === 0 && <p>Không có đoạn trích của phương pháp đang chọn.</p>}
    <p className={styles.sourceText} data-quote>{segment(text, visible).map((part, index) => part.span ? <button key={index} type="button" data-label={part.span.label} data-mismatch={mismatches.some(span => evidenceKey(span) === evidenceKey(part.span!)) || undefined} aria-label={LABEL_NAME[part.span.label] + ': ' + part.text} aria-pressed={active.has(evidenceKey(part.span))} onClick={() => onSelect(part.span!)}><span className={styles.sourceLabel} aria-hidden="true">{LABEL_TEXT[part.span.label]}</span><Phrases text={part.text} /></button> : <Phrases key={index} text={part.text} />)}</p>
    {mismatches.length > 0 && <p>Các đoạn viền đứt có nhãn khác nhau giữa các cách đọc. Chọn Regex hoặc LLM để đối chiếu.</p>}
  </>;
}

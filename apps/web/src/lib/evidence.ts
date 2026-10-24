import type { Evidence } from './api/types';

export function evidenceKey(e: Pick<Evidence, 'start' | 'end'>): string {
  return `${e.start}-${e.end}`;
}

interface Segment {
  text: string;
  span?: Evidence;
}

/**
 * Evidence offsets are Unicode code points on the stored text; JavaScript strings are UTF-16.
 * Splitting with Array.from walks code points, so emoji before a span do not shift it.
 */
export function segment(text: string, evidence: Evidence[]): Segment[] {
  const cps = Array.from(text);
  const spans = [...evidence].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Segment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor || span.end > cps.length) continue; // overlapping or out of range: skip
    if (span.start > cursor) out.push({ text: cps.slice(cursor, span.start).join('') });
    out.push({ text: cps.slice(span.start, span.end).join(''), span });
    cursor = span.end;
  }
  if (cursor < cps.length) out.push({ text: cps.slice(cursor).join('') });
  return out;
}

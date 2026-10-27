import type { Evidence } from '@/lib/api/types';
import { evidenceKey, segment } from '@/lib/evidence';
import { EvidenceHighlighter } from '@/components/EvidenceHighlighter/EvidenceHighlighter';
import a from './analyze.module.css';
import r from './reading.module.css';

export function preservePhrases(value: string) {
  return value.split(/(\d[\d.,]*(?:[–-]\d[\d.,]*)? (?:tin tương tự|ký tự|MB|tháng|m²|tr|đ)|\/(?:người\/tháng|m²\/tháng|tháng|người|số|khối)|Theo phòng|Theo người|Chưa rõ cơ sở tính|Chưa rõ phường|Chưa rõ loại|Không đề cập|không đề cập|Chưa xác định|Chung cư mini|Căn hộ dịch vụ|Nhà nguyên căn|Phòng trọ|Nước \(theo người\)|Nước \(theo khối\)|Giá thuê|giá thuê|Diện tích|diện tích|Vị trí|Dịch vụ|Gửi xe|Đặt cọc|Miễn phí|theo phòng|theo người|một lần|Cầu Giấy|Yên Hòa|Nghĩa Đô|Nam Từ Liêm|Đại học Quốc gia|thang máy)/g).map((part, index) =>
    index % 2 ? <span key={index} className={a.phrase}>{part}</span> : part);
}

// Render shared marks per segment so plain text can preserve short phrases too.
// Selection always maps back to the original Unicode offsets.
export function AnalysisEvidence({ text, evidence, active, onSelect }: { text: string; evidence: Evidence[]; active: Set<string>; onSelect: (value: Evidence) => void }) {
  return <div className={r.evidence}>{segment(text, evidence).map((part, index) => {
    if (!part.span) return <span key={index}>{preservePhrases(part.text)}</span>;
    const local = { ...part.span, start: 0, end: Array.from(part.text).length };
    return <EvidenceHighlighter key={index} className={r.evidencePart} text={part.text} evidence={[local]} active={active.has(evidenceKey(part.span)) ? new Set([evidenceKey(local)]) : undefined} onSelect={() => onSelect(part.span!)} />;
  })}</div>;
}

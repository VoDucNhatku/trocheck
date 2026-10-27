'use client';
import type { Evidence, Listing } from '@/lib/api/types';
import { evidenceKey } from '@/lib/evidence';
import { preservePhrases } from './AnalysisEvidence';
import { feeLabel, groundedEvidence, receiptFee, receiptFields, receiptRent } from './receipt-model';
import r from './reading.module.css';

// Feature-local Receipt until the shared component replaces it.
export function Receipt({ listing, text, active, onSelect }: { listing: Listing; text: string; active: Set<string>; onSelect: (evidence: Evidence[]) => void }) {
  const rent = receiptRent(listing, text);
  const priceEvidence = groundedEvidence(text, listing.rent.evidence);
  const fields = receiptFields(listing, text);
  const fees = listing.fees.filter(fee => fee.type !== 'deposit');
  const deposits = listing.fees.filter(fee => fee.type === 'deposit');
  const selected = (values: Evidence[]) => values.some(value => active.has(evidenceKey(value)));
  function feeRows(values: typeof fees) {
    return values.map((fee, index) => {
      const evidence = groundedEvidence(text, fee.evidence);
      return <button key={fee.type + ':' + index} type="button" className={r.feeRow} disabled={!evidence.length} aria-pressed={selected(evidence)} onClick={() => onSelect(evidence)}><span>{preservePhrases(feeLabel(fee))}</span><strong>{preservePhrases(evidence.length ? receiptFee(fee) : 'Không có bằng chứng xác định')}</strong>{(fee.type === 'other' || fee.unit === 'unknown') && evidence.length > 0 && <small data-quote>{preservePhrases(evidence.map(item => item.quote).join(' · '))}</small>}</button>;
    });
  }
  return <section className={r.receipt} aria-label="Phiếu đọc bài đăng"><header className={r.receiptHead}><h2>PHIẾU ĐỌC BÀI ĐĂNG</h2><span>Giá, phí và cọc giữ riêng</span></header>
    <button type="button" className={r.price} disabled={!priceEvidence.length} aria-pressed={selected(priceEvidence)} onClick={() => onSelect(priceEvidence)}><span>{preservePhrases('Giá thuê')}</span><strong>{preservePhrases(rent.unverified || priceEvidence.length ? rent.main : 'Không đề cập')}</strong><span>{preservePhrases(rent.unverified ? 'Cần xác nhận lại giá thuê' : rent.missing ? 'Không suy giá khi bài thiếu số' : rent.suffix || 'Chưa rõ kỳ tính giá')}</span><small>{preservePhrases(listing.rent.basis === 'unknown' ? 'Chưa rõ giá theo phòng hay theo người' : 'Bấm để xem đoạn giá trong bài')}</small></button>
    {rent.unverified ? <p className={r.hint}>{rent.reason}</p> : listing.rent.decision === 'needs_review' && <p className={r.hint}>Giá cần kiểm tra lại với bài gốc. Kết quả trích xuất chưa được xác nhận.</p>}
    {fields.map(field => <button key={field.title} type="button" className={r.fieldRow} disabled={!field.evidence.length} aria-pressed={selected(field.evidence)} onClick={() => onSelect(field.evidence)}><span>{preservePhrases(field.title)}</span><strong>{preservePhrases(field.value)}</strong></button>)}
    {listing.room.evidence.length > 0 && <details className={r.roomQuotes}><summary>Chữ về phòng và tiện nghi trong bài</summary><ul>{groundedEvidence(text, listing.room.evidence).map((value, index) => <li key={index}><button type="button" data-quote aria-pressed={active.has(evidenceKey(value))} onClick={() => onSelect([value])}>{preservePhrases(value.quote)}</button></li>)}</ul></details>}
    <h3>{preservePhrases('Các khoản phí — tách khỏi giá thuê')}</h3>{fees.length ? feeRows(fees) : <p>{preservePhrases('Không đề cập')}</p>}
    <div className={r.deposit}><h3>{preservePhrases('Đặt cọc')}</h3>{deposits.length ? feeRows(deposits) : <p>{preservePhrases('Không đề cập')}</p>}</div>
    <p className={r.hint}>Phần thiếu giữ là thiếu. Không cộng phí hoặc cọc vào tiền nhà.</p>
  </section>;
}

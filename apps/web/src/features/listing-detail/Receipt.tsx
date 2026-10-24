'use client';
import type { Listing } from '@/lib/api/types';
import { AtomicText, Phrase } from '@/features/landing/examples';
import type { ReceiptRow } from './receipt-model';
import { receiptModel } from './receipt-model';
import styles from './DetailBody.module.css';

// Feature-local until the shared Receipt replaces it.
export function Receipt({listing,model,active,onSelect}:{listing:Listing;model:ReturnType<typeof receiptModel>;active:string|null;onSelect:(id:string)=>void}) {
  const renderRow=(row:ReceiptRow)=><button key={row.id} type="button" className={styles.row} data-receipt-row={row.id} disabled={!row.evidence.length} aria-pressed={active===row.id} onClick={()=>onSelect(row.id)}><span>{row.label}:</span>{' '}<strong><AtomicText text={row.value} /></strong></button>;
  const fees=model.rows.filter(r=>r.section==='fee'),deposits=model.rows.filter(r=>r.section==='deposit');
  return <section className={styles.receipt} aria-labelledby="receipt-title">
    <header className={styles.receiptHead}><h2 id="receipt-title">Phiếu giá</h2><span>Giá, phí và cọc giữ riêng</span></header>
    <button type="button" className={styles.rent} data-receipt-row="rent" disabled={!model.rentEvidence.length} aria-pressed={active==='rent'} onClick={()=>onSelect('rent')}><span><Phrase>Giá thuê</Phrase></span><strong><AtomicText text={model.price} /></strong>{model.suffix&&<span>{model.suffix}</span>}</button>
    {listing.rent.includes.length>0&&<p className={styles.hint}>Bài có ghi khoản đã bao trong giá. Đối chiếu đoạn giá để đọc đầy đủ.</p>}
    {listing.rent.basis==='per_person'&&<p className={styles.hint}>Giá tính theo người. Không nhân lên theo số người ở.</p>}
    {listing.rent.basis==='unknown'&&<p className={styles.hint}>Chưa rõ cách tính giá.</p>}
    {listing.rent.decision==='needs_review'&&<p className={styles.hint}>Giá cần kiểm tra lại với bài gốc.</p>}
    {model.rows.filter(r=>r.section==='fact').map(renderRow)}
    <h3>Các khoản phí</h3>{fees.length?fees.map(renderRow):<p className={styles.emptyValue}><Phrase>Không đề cập</Phrase></p>}
    <div className={styles.deposit}><h3>Đặt cọc</h3>{deposits.length?deposits.map(renderRow):<p className={styles.emptyValue}><Phrase>Không đề cập</Phrase></p>}</div>
    <p className={styles.hint}>Bấm một dòng để đối chiếu chữ trong bài. Không cộng giá thuê, phí và cọc thành tổng.</p>
  </section>;
}

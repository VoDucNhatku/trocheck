import type { Comparison } from '@/lib/api/types';
import { formatDate, formatVnd, PROPERTY_LABEL } from '@/lib/format';
import { AtomicText, Phrase } from '@/features/landing/examples';
import { comparisonReady } from './receipt-model';
import styles from './DetailBody.module.css';

// Feature-local until Codex 8 consolidates the shared mean-only PriceCompare.
export function PriceCompare({comparison:c,targetRent}:{comparison:Comparison;targetRent:number|null}) {
  const ready=comparisonReady(c);
  return <section className={styles.comparison} aria-labelledby="compare-title">
    <h2 id="compare-title">So với cùng nhóm</h2>
    <p className={styles.verdict} data-v={ready&&c.delta_percent!=null?c.verdict??'none':'none'}><AtomicText text={c.message} /></p>
    {ready?<dl className={styles.comparisonValues}><div><dt><Phrase>Trung bình</Phrase> nhóm</dt><dd><AtomicText text={formatVnd(c.mean_vnd!)} /> <small>/tháng{c.criteria.basis==='per_person'?'/người':''}</small></dd></div>{targetRent!=null&&<div><dt>Tin này</dt><dd><AtomicText text={formatVnd(targetRent)} /> <small>/tháng{c.criteria.basis==='per_person'?'/người':''}</small></dd></div>}</dl>:<p className={styles.hint}>{c.status==='insufficient_data'?'Cần ít nhất 10 tin tương tự để nhận định.':c.status==='ok'?'Chưa có giá trung bình hợp lệ để hiển thị.':'Chỉ so sánh khi tin có giá và cách tính phù hợp.'}</p>}
    <p className={styles.hint}><AtomicText text={`Nhóm: ${PROPERTY_LABEL[c.criteria.property_type??'unknown']} · ${c.criteria.ward_name??'Chưa rõ phường'} · ${c.criteria.basis==='per_person'?'giá theo người':c.criteria.basis==='per_unit'?'cùng cách tính giá thuê':'chưa rõ cách tính'} · ${c.criteria.broad_group?'nhóm rộng, không xét diện\u00a0tích':c.criteria.area_band?`${c.criteria.area_band} m²`:'chưa rõ diện\u00a0tích'}. Không chia nhóm theo nội thất.`} /></p>
    <p className={styles.hint}>{c.data_from&&c.data_to?`Dữ liệu ${formatDate(c.data_from)} – ${formatDate(c.data_to)}.`:`Cửa sổ dữ liệu ${c.criteria.window_days} ngày.`} Giá chào thuê, không phải giá giao dịch.</p>
    {c.disclaimer&&<p className={styles.hint}><AtomicText text={c.disclaimer} /></p>}
    {c.is_demo&&<p className={styles.hint}>Nhóm so sánh dùng dữ liệu demo.</p>}
  </section>;
}

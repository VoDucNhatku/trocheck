import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ApiState } from '@/components/ApiState/ApiState';
import { getComparison } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/http';
import { formatShort } from '@/lib/format';
import { AtomicText } from '@/features/landing/examples';
import { PriceCompare } from './PriceCompare';
import styles from './DetailBody.module.css';

export async function ComparisonPanel({id,demo,targetRent}:{id:string;demo:boolean;targetRent:number|null}) {
  try {
    const c=await getComparison(id,demo);
    return <><PriceCompare comparison={c} targetRent={targetRent} /><section className={styles.similar} aria-labelledby="similar-title"><header><h2 id="similar-title">Tin tương tự</h2><Link href={`/tim-tro?demo=${demo}`}>Xem thêm tin</Link></header>{c.similar.length?<ul>{c.similar.map(s=><li key={s.listing_id}><Link href={`/tin/${s.listing_id}?demo=${c.is_demo}`}><strong><AtomicText text={formatShort(s.rent_vnd)} /></strong><span>{s.area_m2!=null?<AtomicText text={`${s.area_m2.toLocaleString('vi-VN')} m²`} />:'Không đề cập'}</span><ArrowUpRight size={16} aria-hidden="true" /></Link></li>)}</ul>:<p className={styles.hint}>Chưa có tin tương tự đủ điều kiện để hiển thị.</p>}</section></>;
  } catch(error) {return <ApiState title="Chưa tải được so sánh" message={errorMessage(error)} />}
}

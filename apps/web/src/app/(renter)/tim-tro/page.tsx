import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { EyeOff, SearchX, X } from 'lucide-react';
import { ApiState } from '@/components/ApiState/ApiState';
import { FilterBar } from '@/features/listings/FilterBar';
import { ListingGrid } from '@/features/listings/ListingGrid';
import { Pagination } from '@/features/listings/Pagination';
import { parseFilters, searchUrl, type SearchParams } from '@/features/listings/filters';
import { getListings, getCatalog, getComparison } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/http';
import { PROPERTY_LABEL, formatDate } from '@/lib/format';
import { AtomicText, Phrase } from '@/features/landing/examples';
import type { ListingCard } from '@/lib/api/types';
import { ResultsLoading } from './loading';
import styles from './page.module.css';

export const metadata: Metadata = { title:'Tìm trọ' };
export const dynamic='force-dynamic';
const numberVi=(v:string)=>Number.isFinite(Number(v.replace(',','.')))?Number(v.replace(',','.')).toLocaleString('vi-VN'):v;
const FILTER_LABELS:Record<string,(v:string)=>string>={phuong:v=>v,loai:v=>PROPERTY_LABEL[v as keyof typeof PROPERTY_LABEL]??v,gia_min:v=>`Giá từ ${numberVi(v)} tr`,gia_max:v=>`Giá đến ${numberVi(v)} tr`,dt_min:v=>`DT từ ${numberVi(v)} m²`,dt_max:v=>`DT đến ${numberVi(v)} m²`,co_gia:()=> 'Chỉ tin có giá'};

export default async function SearchPage({searchParams}:{searchParams:Promise<SearchParams>}) {
  const sp=await searchParams;const query=parseFilters(sp);
  const [dataResult,catalogResult]=await Promise.allSettled([getListings(query),getCatalog(query.demo??undefined)]);
  const data=dataResult.status==='fulfilled'?dataResult.value:null;
  const catalog=catalogResult.status==='fulfilled'?catalogResult.value:null;
  const demo=data?.is_demo??catalog?.is_demo??query.demo??undefined;
  const modeParams={...sp,...(demo===undefined?{}:{demo:String(demo)})};
  const active:{key:string;value:string;href:string}[]=[];
  for(const [key,raw] of Object.entries(sp)) {
    if(!FILTER_LABELS[key])continue;
    for(const value of Array.isArray(raw)?raw:[raw??'']) {
      if(!value)continue;
      const rest=(Array.isArray(raw)?raw:[raw]).filter(v=>v!==value);
      active.push({key,value,href:searchUrl({...modeParams,[key]:rest})});
    }
  }
  return <div className={`container ${styles.page}`}>
    <header className={styles.head}><div><p className={styles.eyebrow}>Phòng nào cũng có điều cần đọc kỹ</p><h1>Tìm trọ, <em>đọc rõ giá.</em></h1><p className={styles.lead}>{data?.data_as_of?`Dữ liệu cập nhật ${formatDate(data.data_as_of)}. `:''}Bắt đầu bằng khu vực và mức thuê phù hợp với bạn.</p></div><div className={styles.dataset}><span>{demo===true?'Dữ liệu demo · Ví dụ tự tạo':demo===false?'Kho dữ liệu thật':'Đang xác định bộ dữ liệu'}</span>{demo!==undefined&&<Link href={searchUrl({demo:String(!demo)})}>{demo?'Xem kho thật':'Xem bộ demo'}</Link>}</div></header>
    <div className={styles.layout}>
      <Suspense fallback={<p role="status">Đang tải bộ lọc…</p>}><FilterBar wards={catalog?.wards??[]} demo={demo} /></Suspense>
      <section className={styles.results} aria-label="Kết quả tìm trọ">
        {catalogResult.status==='rejected'&&<ApiState title="Chưa tải được danh mục phường" message={errorMessage(catalogResult.reason)} />}
        <div className={styles.summary} aria-live="polite"><h2>{data?`${data.total.toLocaleString('vi-VN')} tin phù hợp`:'Danh sách tin'}</h2>{data&&data.hidden_no_price>0&&<p className={styles.hidden}><EyeOff size={16} aria-hidden="true" />{data.hidden_no_price.toLocaleString('vi-VN')} tin không có giá cụ thể bị ẩn vì đang lọc theo giá <Link href={searchUrl({...modeParams,gia_min:undefined,gia_max:undefined,co_gia:undefined})}>Bỏ lọc giá để hiện</Link></p>}</div>
        {active.length>0&&<ul className={styles.remove} aria-label="Điều kiện đang áp dụng">{active.map(a=><li key={`${a.key}-${a.value}`}><Link href={a.href} scroll={false} aria-label={`Bỏ lọc ${FILTER_LABELS[a.key](a.value)}`}><span><AtomicText text={FILTER_LABELS[a.key](a.value)} /></span><X size={14} aria-hidden="true" /></Link></li>)}</ul>}
        {dataResult.status==='rejected'?<ApiState title="Chưa tải được danh sách" message={errorMessage(dataResult.reason)} />:data&&data.items.length>0?<Suspense fallback={<ResultsLoading />}><ComparedListings items={data.items} demo={data.is_demo} /></Suspense>:<div className={styles.empty}><SearchX size={28} strokeWidth={1.5} aria-hidden="true" /><h2>{catalog?.total===0?'Kho chưa có tin':data&&data.total>0?'Trang này không có tin':'Không có tin nào khớp đủ các điều kiện'}</h2><p>{catalog?.total===0?'Khi có tin đã đóng góp và được chấp nhận, tin sẽ xuất hiện ở đây.':data&&data.total>0?'Dùng phân trang để về trang có dữ liệu.':active.length?'Bỏ bớt điều kiện phía trên hoặc xóa lọc để xem thêm tin.':'Chưa có tin hiển thị. Hãy thử lại sau.'}</p>{active.length>0&&<Link className={styles.clear} href={searchUrl({demo:demo===undefined?undefined:String(demo)})}>Xóa lọc</Link>}</div>}
        {data&&<Pagination page={data.page} pageSize={data.page_size} total={data.total} params={modeParams} />}
      </section>
    </div>
    <p className={styles.note}>Giá chào thuê trong bài đăng, không phải giá giao dịch. <Phrase>Giá thuê</Phrase> và các khoản phí được trình bày riêng. Mở tin để đọc đầy đủ bằng chứng và nhóm so sánh.</p>
  </div>;
}
async function ComparedListings({items,demo}:{items:ListingCard[];demo:boolean}) {
  // The list DTO has no message; read the existing comparison endpoint, isolating per-card failures.
  const entries=await Promise.all(items.map(async card=>[card.listing_id,await getComparison(card.listing_id,demo).catch(()=>null)] as const));
  return <ListingGrid items={items} comparisons={Object.fromEntries(entries)} />;
}

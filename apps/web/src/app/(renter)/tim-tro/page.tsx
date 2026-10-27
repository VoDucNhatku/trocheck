import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { EyeOff, SearchX, X } from 'lucide-react';
import { ApiState } from '@/components/ApiState/ApiState';
import { FilterBar } from '@/features/listings/FilterBar';
import { ListingGrid } from '@/features/listings/ListingGrid';
import { Pagination } from '@/features/listings/Pagination';
import { parseFilters, searchUrl, type SearchParams } from '@/features/listings/filters';
import { getListings, getCatalog } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/http';
import { PROPERTY_LABEL, formatDate } from '@/lib/format';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Tìm trọ' };
export const dynamic = 'force-dynamic';
const FILTER_LABELS: Record<string, (v: string) => string> = {
  phuong: (v) => v,
  loai: (v) => PROPERTY_LABEL[v as keyof typeof PROPERTY_LABEL] ?? v,
  gia_min: (v) => `Giá từ ${v} tr`, gia_max: (v) => `Giá đến ${v} tr`,
  dt_min: (v) => `DT từ ${v} m²`, dt_max: (v) => `DT đến ${v} m²`, co_gia: () => 'Chỉ tin có giá',
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const query = parseFilters(sp);
  // Catalog and filtered data fail independently. Never substitute a partial catalog.
  const [dataResult, catalogResult] = await Promise.allSettled([getListings(query), getCatalog(query.demo ?? undefined)]);
  if (dataResult.status === 'rejected') return <div className={`container ${styles.page}`}>
    <h1 className={styles.title}>Tìm trọ</h1>
    <ApiState title="Chưa tải được danh sách" message={errorMessage(dataResult.reason)} />
  </div>;
  const data = dataResult.value;
  const catalog = catalogResult.status === 'fulfilled' ? catalogResult.value : null;
  const modeParams = { ...sp, demo: String(data.is_demo) };
  const active: { key: string; value: string; href: string }[] = [];
  for (const [key, raw] of Object.entries(sp)) {
    if (!FILTER_LABELS[key]) continue;
    for (const value of Array.isArray(raw) ? raw : [raw ?? '']) {
      const rest = (Array.isArray(raw) ? raw : [raw]).filter((v) => v !== value);
      active.push({ key, value, href: searchUrl({ ...modeParams, [key]: rest }) });
    }
  }
  const emptyWarehouse = catalog?.total === 0;
  return <div className={`container ${styles.page}`}>
    <header className={styles.head}>
      <h1 className={styles.title}>Tìm trọ</h1>
      <p className={styles.meta}>{data.data_as_of ? `Dữ liệu cập nhật ${formatDate(data.data_as_of)}` : 'Chưa có ngày cập nhật'} · giá chào thuê, không phải giá giao dịch</p>
      <p>{data.is_demo ? 'Đang xem dữ liệu demo · ví dụ tự tạo' : 'Đang xem kho dữ liệu thật'} · <Link href={searchUrl({ demo: String(!data.is_demo) })}>{data.is_demo ? 'Xem kho thật' : 'Xem bộ demo (nếu máy chủ cho phép)'}</Link></p>
    </header>
    {catalogResult.status === 'rejected' && <ApiState title="Chưa tải được danh mục phường" message={errorMessage(catalogResult.reason)} />}
    <Suspense><FilterBar wards={catalog?.wards ?? []} /></Suspense>
    <div className={styles.summary} aria-live="polite">
      <p><strong className="num">{data.total}</strong> tin phù hợp</p>
      {data.hidden_no_price > 0 && <p className={styles.hidden}><EyeOff size={14} aria-hidden="true" /> {data.hidden_no_price} tin không có giá cụ thể bị ẩn vì đang lọc theo giá</p>}
    </div>
    {data.items.length > 0 ? <ListingGrid items={data.items} /> : <div className={styles.empty}>
      <SearchX size={28} strokeWidth={1.5} aria-hidden="true" />
      <h2>{emptyWarehouse ? 'Kho chưa có tin' : data.total > 0 ? 'Trang này không có tin' : 'Không có tin nào khớp đủ các điều kiện'}</h2>
      <p>{emptyWarehouse ? 'Khi có tin đã đóng góp và được chấp nhận, tin sẽ xuất hiện ở đây.' : data.total > 0 ? 'Dùng phân trang để về trang có dữ liệu.' : active.length ? 'Bỏ bớt từng điều kiện dưới đây để xem thêm tin:' : 'Chưa có tin hiển thị. Hãy thử lại sau.'}</p>
      {active.length > 0 && <ul className={styles.remove}>{active.map((a) => <li key={`${a.key}-${a.value}`}><Link href={a.href} scroll={false}>{FILTER_LABELS[a.key](a.value)} <X size={13} aria-label="bỏ điều kiện" /></Link></li>)}</ul>}
    </div>}
    <Pagination page={data.page} pageSize={data.page_size} total={data.total} params={modeParams} />
  </div>;
}

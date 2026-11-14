import type { StatsOverview } from '@/lib/api/types';
import { formatDate } from '@/lib/format';

/** Counts include processed listings awaiting review; they are not public listing counts. */
export function HomeStats({ data }: { data: StatsOverview | null }) {
  return <section className="stats-band wrap" aria-label="Số liệu kho" data-react-section>
    <span className="demo">{data ? data.is_demo ? 'Số liệu demo' : 'Số liệu kho' : 'Chưa tải được số liệu'}</span>
    <div><strong id="stat-total" data-count={data?.total_listings}>{data?.total_listings.toLocaleString('vi-VN') ?? '—'}</strong><span>tin đã xử lý</span></div>
    {data && !data.is_demo && data.store_listings != null && <div><strong id="stat-store" data-count={data?.store_listings}>{data?.store_listings?.toLocaleString('vi-VN') ?? '—'}</strong><span>tin <span className="phrase">dùng để so giá</span>{data?.store_districts ? <> · <span className="phrase">{data.store_districts.toLocaleString('vi-VN')} quận cũ</span></> : null}</span></div>}
    <div><strong id="stat-eligible" data-count={data?.eligible_listings}>{data?.eligible_listings.toLocaleString('vi-VN') ?? '—'}</strong><span>tin <span className="phrase">đã duyệt</span> <span className="phrase">đủ điều kiện</span> theo phường</span></div>
    <div><strong>{data?.updated_at ? formatDate(data.updated_at) : '—'}</strong><span>{data?.updated_at ? <><span className="phrase">lần xử lý</span> <span className="phrase">gần nhất</span></> : <>Chưa có <span className="phrase">ngày cập nhật</span></>}</span></div>
  </section>;
}

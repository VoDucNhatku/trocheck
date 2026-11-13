import type { StatsOverview } from '@/lib/api/types';
import { formatDate } from '@/lib/format';

/** Counts include processed listings awaiting review; they are not public listing counts. */
export function HomeStats({ data }: { data: StatsOverview | null }) {
  return <section className="stats-band wrap" aria-label="Số liệu kho" data-react-section>
    <span className="demo">{data ? data.is_demo ? 'Số liệu demo' : 'Số liệu kho' : 'Chưa tải được số liệu'}</span>
    <div><strong id="stat-total" data-count={data?.total_listings}>{data?.total_listings.toLocaleString('vi-VN') ?? '—'}</strong><span>tin đã xử lý</span></div>
    <div><strong id="stat-eligible" data-count={data?.eligible_listings}>{data?.eligible_listings.toLocaleString('vi-VN') ?? '—'}</strong><span>tin <span className="phrase">đủ điều kiện</span> <span className="phrase">thống kê</span></span></div>
    <div><strong>{data?.updated_at ? formatDate(data.updated_at) : '—'}</strong><span>{data?.updated_at ? <><span className="phrase">lần xử lý</span> <span className="phrase">gần nhất</span></> : <>Chưa có <span className="phrase">ngày cập nhật</span></>}</span></div>
  </section>;
}

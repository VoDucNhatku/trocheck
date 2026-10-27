'use client';
import { useEffect, useState } from 'react';
import type { MarketSummary } from '@/lib/workspace/types';
import { api, messageOf } from '@/lib/workspace/client';
import { PROPERTY_LABEL, dataRangeSentence, formatDate, formatVnd } from '@/lib/format';
import { DataBadge, Empty, ErrorNotice, Intro, Loading, Button, s } from './ui';

const EXCLUDED: Record<string, string> = { not_contributed: 'Chưa đóng góp', not_approved: 'Chưa được chấp nhận', rejected: 'Đã loại', duplicate: 'Trùng tin', non_exact_price: 'Giá không cụ thể', price_not_exact: 'Giá không cụ thể', basis_unknown: 'Chưa rõ cơ sở giá', period_not_month: 'Giá không theo tháng', not_monthly: 'Giá không theo tháng', ward_unresolved: 'Chưa xác định phường', outside_window: 'Ngoài cửa sổ thời gian', old: 'Ngoài thời gian', not_rental_offer: 'Không phải bài cho thuê', demo_mismatch: 'Khác bộ dữ liệu' };
export function Market({ query, filters }: { query: string; filters: { ward: string; type: string; basis: string; demo: string } }) {
  const [data, setData] = useState<MarketSummary | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('');
    api<MarketSummary>('market/summary?' + query, { signal: controller.signal }).then(setData).catch(caught => { if (!controller.signal.aborted) setError(messageOf(caught)); });
    return () => controller.abort();
  }, [query, reload]);
  const chartCells = data?.cells.filter(cell => cell.median != null).slice(0, 10) ?? [];
  const top = Math.ceil(Math.max(1, ...chartCells.map(cell => cell.median!)) / 1000000) * 1000000;
  return <><Intro title="Một mặt bằng giá có căn cứ" eyebrow="Thị trường" description="Giá chào thuê được nhóm theo phường, loại phòng và cơ sở tính. Trung vị chỉ xuất hiện khi nhóm có đủ mẫu." />
    <form action="/thi-truong" className={s.filters}>
      <label className={s.field}><span className={s.label}>Phường (tên hoặc mã)</span><input className={s.input} name="ward" defaultValue={filters.ward} placeholder="Tất cả phường" /></label>
      <label className={s.field}><span className={s.label}>Loại phòng</span><select className={s.select} name="type" defaultValue={filters.type}><option value="">Tất cả loại</option>{Object.entries(PROPERTY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className={s.field}><span className={s.label}>Cơ sở giá</span><select className={s.select} name="basis" defaultValue={filters.basis}><option value="per_unit">Theo phòng / tháng</option><option value="per_person">Theo người / tháng</option></select></label>
      <label className={s.field}><span className={s.label}>Bộ dữ liệu</span><select className={s.select} name="demo" defaultValue={filters.demo}><option value="true">Demo tự tạo</option><option value="false">Kho thật</option></select></label>
      <Button type="submit">Áp dụng bộ lọc</Button>
    </form>
    {error ? <ErrorNotice message={error} retry={() => setReload(reload + 1)} /> : !data ? <Loading /> : <>
      <div className={[s.between, s.notice].join(' ')}><p>{dataRangeSentence(data.data_from, data.data_to)}</p><DataBadge demo={data.is_demo} /></div>
      {!data.cells.length ? <Empty title="Chưa có nhóm giá cho lựa chọn này"><p>Chọn bộ dữ liệu hoặc bộ lọc khác. Tin thiếu giá cụ thể, cơ sở tính hoặc điều kiện thống kê không được dùng để dựng trung vị.</p></Empty> : <>
        <section className={[s.panel, s.section].join(' ')}><div className={s.panelHead}><h2 className={s.panelTitle}>Phân bố theo nhóm</h2><span className={s.muted}>Tối thiểu N = {data.min_n}</span></div>
          <p className={s.scrollHint}>Vuốt ngang hoặc dùng phím mũi tên trong bảng để xem đủ cột.</p><div className={s.tableWrap} tabIndex={0} role="region" aria-label="Bảng giá theo nhóm, cuộn ngang để xem đủ cột"><table className={s.table}><caption className="visually-hidden">Giá chào thuê theo {filters.basis === 'per_person' ? 'người' : 'phòng'} mỗi tháng, đơn vị đồng</caption><thead><tr><th scope="col">Phường / loại</th><th scope="col">N</th><th scope="col">P25</th><th scope="col">Trung vị</th><th scope="col">P75</th><th scope="col">Ngày dữ liệu</th></tr></thead><tbody>
            {data.cells.map(cell => <tr key={[cell.ward_code, cell.ward_name, cell.property_type].join(':')}><th scope="row" style={{ textTransform: 'none', background: 'none', fontSize: 12 }}><strong>{cell.ward_name ?? 'Chưa rõ phường'}</strong><br /><span className={s.muted}>{PROPERTY_LABEL[cell.property_type]}</span></th><td>{cell.n}</td><td className={s.numeric}>{cell.p25 == null ? 'Chưa đủ mẫu' : formatVnd(cell.p25)}</td><td className={s.numeric}><strong>{cell.median == null ? 'Chưa đủ mẫu' : formatVnd(cell.median)}</strong></td><td className={s.numeric}>{cell.p75 == null ? 'Chưa đủ mẫu' : formatVnd(cell.p75)}</td><td className={[s.muted, s.numeric].join(' ')}>{formatDate(cell.data_from)}<br />{formatDate(cell.data_to)}</td></tr>)}
          </tbody></table></div><p className={s.hint} style={{ marginTop: 16 }}>P25–P75 là khoảng giữa của nhóm tin. Không dùng các nhóm khác cơ sở tính để xếp hạng giá.</p>
        </section>
        {chartCells.length > 0 && <section className={[s.panel, s.section].join(' ')}><h2 className={s.panelTitle}>Trung vị giá chào thuê</h2><p className={s.muted}>Triệu đồng / tháng / {filters.basis === 'per_person' ? 'người' : 'phòng'} · tối đa 10 nhóm đầu đủ mẫu. Bảng phía trên là dữ liệu đầy đủ.</p>
          <svg className={s.chart} viewBox={'0 0 ' + (chartCells.length * 100 + 100) + ' 280'} role="img" aria-labelledby="market-chart-title market-chart-desc">
            <title id="market-chart-title">Trung vị giá chào thuê theo nhóm</title><desc id="market-chart-desc">Trục dọc là triệu đồng mỗi tháng, trục ngang là các nhóm trong bảng.</desc>
            {[0, .25, .5, .75, 1].map(ratio => <g key={ratio}><line x1="55" x2={chartCells.length * 100 + 80} y1={220 - ratio * 180} y2={220 - ratio * 180} /><text x="45" y={224 - ratio * 180} textAnchor="end">{(top * ratio / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</text></g>)}
            {chartCells.map((cell, index) => <g key={index}><rect x={75 + index * 100} width="32" y={220 - cell.median! / top * 180} height={cell.median! / top * 180} /><text textAnchor="middle" x={91 + index * 100} y="244">Nhóm {index + 1}</text><text textAnchor="middle" x={91 + index * 100} y={210 - cell.median! / top * 180}>{(cell.median! / 1000000).toLocaleString('vi-VN')}</text></g>)}
          </svg><ol className={s.questions}>{chartCells.map((cell, index) => <li key={index}>Nhóm {index + 1}: {cell.ward_name} · {PROPERTY_LABEL[cell.property_type]} · N = {cell.n}</li>)}</ol>
        </section>}
      </>}
      <details className={s.disclosure}><summary>Điều kiện thống kê và tin bị loại</summary><p className={s.muted}>Cửa sổ {data.window_days} ngày. Chỉ giá chính xác theo tháng, cùng cơ sở tính; một tin đại diện mỗi cụm. ReNER lấy thống kê từ máy chủ.</p><ul className={s.questions}>{Object.entries(data.excluded_counts).map(([reason, count]) => <li key={reason}>{EXCLUDED[reason] ?? 'Điều kiện ' + reason}: {count.toLocaleString('vi-VN')} tin</li>)}</ul></details>
    </>}
  </>;
}

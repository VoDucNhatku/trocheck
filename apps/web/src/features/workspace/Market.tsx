'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { MarketSummary } from '@/lib/workspace/types';
import { api, messageOf } from '@/lib/workspace/client';
import { PROPERTY_LABEL, dataRangeSentence, formatVnd } from '@/lib/format';
import { formatRent } from '@/lib/display-format';
import { Button } from '@/components/Button/Button';
import { Field } from '@/components/Field/Field';
import { PhraseText } from '@/components/PhraseText/PhraseText';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { DataBadge } from './ui';
import { MARKET_TYPES, marketAreaReady, marketMeanReady, marketMinimum, marketQuery, marketSearchUrl, marketWards, type MarketCell, type MarketFilters } from './Market.model';
import styles from './Market.module.css';

const EXCLUDED: Record<string, string> = { not_contributed: 'Chưa đóng góp', not_approved: 'Chưa được chấp nhận', not_accepted: 'Chưa được chấp nhận', rejected: 'Đã loại', duplicate: 'Trùng tin', non_exact_price: 'Giá không cụ thể', price_not_exact: 'Giá không cụ thể', basis_unknown: 'Chưa rõ cách tính giá', property_type_unknown: 'Chưa rõ loại phòng', period_not_month: 'Giá không theo tháng', not_monthly: 'Giá không theo tháng', ward_unresolved: 'Chưa xác định phường', outside_window: 'Ngoài cửa sổ thời gian', old: 'Ngoài thời gian', not_rental_offer: 'Không phải bài cho thuê', demo_mismatch: 'Khác bộ dữ liệu' };

function WardName({ name }: { name: string }) {
  return name.length <= 22 && name.trim().split(/\s+/u).length <= 3 ? <span className={styles.phrase}>{name}</span> : <PhraseText text={name} />;
}

function Cell({ cell, type, ward, minimum, demo }: { cell?: MarketCell; type: MarketCell['property_type']; ward: string; minimum: number; demo: boolean }) {
  const ready = marketMeanReady(cell, minimum);
  return <Link className={styles.cell} data-ready={ready} href={marketSearchUrl(ward, type, demo)}>
    <span className={styles.cellType}><PhraseText text={PROPERTY_LABEL[type]} /></span>
    {ready ? <>
      <strong className={styles.price}><PhraseText text={formatVnd(cell.mean_vnd)} /></strong>
      <span className={styles.unit}>/tháng{cell.basis === 'per_person' ? '/người' : ''}</span>
      {marketAreaReady(cell, minimum)
        ? <span className={styles.area}><PhraseText text={`${formatVnd(cell.mean_per_m2)}/m²/tháng${cell.basis === 'per_person' ? '/người' : ''}`} /></span>
        : <span className={styles.meta}>Giá theo m²: Chưa đủ dữ liệu{` (${cell.n_per_m2}/${minimum} tin có diện tích)`}</span>}
    </> : <strong className={styles.insufficient}>{!cell || cell.n < minimum ? 'Chưa đủ dữ liệu' : <>Chưa có giá <span className={styles.phrase}>trung bình</span></>}</strong>}
    <span className={styles.meta}>{cell ? ready ? `${cell.n.toLocaleString('vi-VN')} tin` : `${cell.n.toLocaleString('vi-VN')}/${minimum} tin` : 'Chưa có tin trong nhóm này'}</span>
  </Link>;
}

export function Market({ query, filters, wards = [], showThemeToggle = true }: { query: string; filters: MarketFilters; wards?: string[]; showThemeToggle?: boolean }) {
  const router = useRouter();
  const [result, setResult] = useState<{ query: string; data?: MarketSummary; error?: string }>({ query });
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult({ query });
    api<MarketSummary>('market/summary?' + query, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      .then(data => { if (!controller.signal.aborted) setResult({ query, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ query, error: messageOf(error) }); });
    return () => controller.abort();
  }, [query, reload]);

  const data = result.query === query ? result.data : undefined;
  const error = result.query === query ? result.error : undefined;
  // Keep unlike price bases separate even if an upstream response contains both.
  const cells = data?.cells.filter(cell => cell.basis === filters.basis) ?? [];
  const grouped = marketWards(cells);
  const types: MarketCell['property_type'][] = filters.type ? [filters.type as MarketCell['property_type']] : [...MARKET_TYPES, ...(cells.some(cell => cell.property_type === 'unknown') ? ['unknown' as const] : [])];
  const minimum = marketMinimum(data?.min_n ?? 10);
  const readyCells = cells.filter(cell => marketMeanReady(cell, minimum));
  const maxPrice = Math.max(1, ...readyCells.map(cell => cell.mean_vnd!));

  return <div className={styles.page}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>Thị trường</p><h1><span className={styles.phrase}>Giá thuê</span>{' '}<span className={styles.phrase}>trung bình</span>{' '}<em className={styles.phrase}>theo phường.</em></h1><p className={styles.lead}>{data ? dataRangeSentence(data.data_from, data.data_to) : 'Giá chào thuê trong bài đăng, không phải giá giao dịch.'}</p></div>
      <div className={styles.headingTools}>{data && <DataBadge demo={data.is_demo} />}{showThemeToggle && <ThemeToggle />}</div>
    </header>

    <section className={styles.controls} aria-label="Bộ lọc thị trường">
      <div className={styles.basis} role="group" aria-label="Cách tính giá">
        <Button variant="secondary" aria-pressed={filters.basis === 'per_unit'} onClick={() => router.push('/thi-truong?' + marketQuery({ ...filters, basis: 'per_unit' }))}>Giá theo phòng</Button>
        <Button variant="secondary" aria-pressed={filters.basis === 'per_person'} onClick={() => router.push('/thi-truong?' + marketQuery({ ...filters, basis: 'per_person' }))}>Giá theo người</Button>
      </div>
      <p className={styles.note}>Cùng cách tính giá mới so sánh với nhau. Các nhóm dưới {minimum} tin ghi “Chưa đủ dữ liệu”.</p>
      <form key={query} action="/thi-truong" className={styles.filters}>
        <input type="hidden" name="basis" value={filters.basis} />
        <Field label="Phường (tên hoặc mã)" name="ward" defaultValue={filters.ward} list="market-wards" placeholder="Tất cả phường" />
        <datalist id="market-wards">{wards.map(ward => <option key={ward} value={ward} />)}</datalist>
        <div className={styles.field}><label htmlFor="market-type"><span className={styles.phrase}>Loại phòng</span></label><select id="market-type" className={styles.select} name="type" defaultValue={filters.type}><option value="">Tất cả loại</option>{Object.entries(PROPERTY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="market-demo">Bộ dữ liệu</label><select id="market-demo" className={styles.select} name="demo" defaultValue={filters.demo}><option value="true">Demo tự tạo</option><option value="false">Kho thật</option></select></div>
        <Button type="submit">Áp dụng bộ lọc</Button>
      </form>
    </section>

    {error ? <section className={styles.state} data-state="error" role="alert"><h2>Chưa tải được dữ liệu.</h2><p>{error}</p><p>Các lựa chọn của bạn vẫn được giữ.</p><Button onClick={() => setReload(value => value + 1)}>Thử lại</Button></section>
      : !data ? <section className={styles.state} role="status" aria-live="polite"><h2>Đang tải dữ liệu thị trường…</h2><p>Đang đọc các nhóm giá theo lựa chọn của bạn.</p><div className={styles.skeleton} aria-hidden="true" /><div className={styles.skeleton} aria-hidden="true" /></section>
        : !grouped.length ? <section className={styles.state}><h2>Chưa có nhóm giá cho lựa chọn này.</h2><p>Thử chọn thêm phường, đổi <span className={styles.phrase}>loại phòng</span> hoặc bộ dữ liệu.</p><Link className={styles.reset} href={'/thi-truong?' + marketQuery({ ...filters, ward: '', type: '' })}>Xóa lọc phường và loại</Link></section>
          : <div className={styles.layout}>
              <div>
                <div className={styles.desktopGrid} data-wide={types.length > 4}><table className={styles.table}><caption><span className={styles.phrase}>Giá thuê</span> trung bình theo phường và <span className={styles.phrase}>loại phòng</span> · <span className={styles.phrase}>{filters.basis === 'per_person' ? 'giá theo người' : 'giá theo phòng'}</span></caption><thead><tr><th scope="col">Phường</th>{types.map(type => <th scope="col" key={type}><PhraseText text={PROPERTY_LABEL[type]} /></th>)}</tr></thead><tbody>{grouped.map(ward => <tr key={ward.key}><th scope="row"><WardName name={ward.name} /></th>{types.map(type => <td key={type}><Cell cell={ward.cells.find(cell => cell.property_type === type)} type={type} ward={ward.filter} minimum={minimum} demo={data.is_demo} /></td>)}</tr>)}</tbody></table></div>
                <div className={styles.mobileGrid} data-wide={types.length > 4}>{grouped.map(ward => <section className={styles.ward} aria-label={ward.name} key={ward.key}><h2><WardName name={ward.name} /></h2>{types.map(type => <Cell key={type} cell={ward.cells.find(cell => cell.property_type === type)} type={type} ward={ward.filter} minimum={minimum} demo={data.is_demo} />)}</section>)}</div>
                <p className={styles.note}>Bấm một ô để mở Tìm trọ theo phường và <span className={styles.phrase}>loại phòng.</span> Danh sách Tìm trọ có thể gồm các cách tính giá khác nhau.</p>
              </div>
              <aside className={styles.chart} aria-label="Mức giá trung bình"><h2>Mức <span className={styles.phrase}>trung bình</span></h2><p className={styles.note}>Chỉ các nhóm đủ {minimum} tin · <span className={styles.phrase}>{filters.basis === 'per_person' ? 'giá theo người' : 'giá theo phòng'}</span>.</p>{readyCells.length ? readyCells.map((cell, index) => <div className={styles.bar} key={`${cell.ward_code}-${cell.property_type}-${index}`}><strong><WardName name={cell.ward_name || 'Chưa rõ phường'} /></strong><span><PhraseText text={PROPERTY_LABEL[cell.property_type]} /> · {cell.n.toLocaleString('vi-VN')} tin</span><b><PhraseText text={formatRent(cell.mean_vnd, cell.basis)} /></b><div className={styles.track} aria-hidden="true"><i style={{ width: `${cell.mean_vnd! / maxPrice * 100}%` }} /></div></div>) : <p className={styles.note}>Chưa đủ dữ liệu để vẽ mức <span className={styles.phrase}>trung bình</span>.</p>}</aside>
            </div>}

    {data && <details className={styles.conditions}><summary>Điều kiện thống kê và tin bị loại</summary><p><PhraseText text={`Cửa sổ ${data.window_days.toLocaleString('vi-VN')} ngày. Chỉ giá chính xác theo tháng, cùng cách tính; một tin đại diện mỗi cụm. TrọCheck đọc thống kê từ máy chủ. Giá theo m² cần ít nhất ${minimum} tin có `} /><span className={styles.phrase}>diện tích</span> hợp lệ.</p><ul>{Object.entries(data.excluded_counts).map(([reason, count]) => <li key={reason}>{EXCLUDED[reason] ?? 'Điều kiện khác'}: {count.toLocaleString('vi-VN')} tin</li>)}</ul></details>}
  </div>;
}

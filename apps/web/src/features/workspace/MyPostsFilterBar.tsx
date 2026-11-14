'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { PROPERTY_LABEL } from '@/lib/format';
import { AtomicText } from '@/features/landing/examples';
import { activeFilterCount, areaLabel, FILTER_ROOM_TYPES, myPostsUrlQuery, parseMyPostsQuery, SORT_LABEL,
  type MyPostsFilters, type MyPostsQuery, type SortKey } from './my-posts-model';
import styles from './my-posts.module.css';

const millions = (vnd?: number) => vnd == null ? '' : String(Math.round(vnd / 10_000) / 100);

export function MyPostsFilterBar({ query, options, busy, onApply, onClear }: {
  query: MyPostsQuery; options: MyPostsFilters | null; busy: boolean;
  onApply: (next: MyPostsQuery) => void; onClear: () => void;
}) {
  const count = activeFilterCount(query);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { setOpen(count > 0 || window.matchMedia('(min-width: 700px)').matches); }, []);
  const areas = options?.areas ?? [];
  const types = [...FILTER_ROOM_TYPES, ...(options?.types.some(t => t.type === 'unknown') ? ['unknown' as const] : [])];
  const typeCounts = new Map((options?.types ?? []).map(t => [t.type, t.listing_count]));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) if (typeof value === 'string' && value.trim()) params.append(key, value.trim());
    if (query.group !== 'all') params.set('nhom', query.group);
    const next = parseMyPostsQuery(params);
    setNotice(next.priceMax == null && params.get('gia_max') ? 'Giá đến thấp hơn giá từ nên đã bỏ giá đến.' : '');
    onApply({ ...next, page: 1 });
  };
  return <form className={styles.filterBar} aria-label="Lọc bài của tôi" onSubmit={submit} key={myPostsUrlQuery(query)}>
    <details open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>Lọc phòng{count ? <span className={styles.phrase}> · {count} bộ lọc</span> : null}</summary>
      <div className={styles.filterGrid}>
        <fieldset className={styles.filterGroup}>
          <legend>Khu vực (quận, huyện cũ)</legend>
          {areas.length ? <div className={styles.areaList}>{areas.map(area =>
            <label className={styles.check} key={area.key}>
              <input type="checkbox" name="khu_vuc" value={area.key} defaultChecked={query.areas.includes(area.key)} />
              <span><AtomicText text={areaLabel(area.name)} /> <span className={styles.count}>· {area.listing_count}</span></span>
            </label>)}</div>
            : <p className={styles.help}>Chưa có phòng nào xác định được phường để lọc theo khu vực.</p>}
          <p className={styles.help}>Tên quận cũ theo bảng đối chiếu sáp nhập; phường mới chung hai quận cũ sẽ khớp cả hai.</p>
        </fieldset>
        <fieldset className={styles.filterGroup}>
          <legend>Giá thuê · triệu/tháng</legend>
          <div className={styles.rangeRow}>
            <label><span>Từ</span><input name="gia_min" type="number" min="0" step="0.1" inputMode="decimal" defaultValue={millions(query.priceMin)} placeholder={options?.price_min_vnd != null ? millions(options.price_min_vnd) : undefined} /></label>
            <label><span>Đến</span><input name="gia_max" type="number" min="0" step="0.1" inputMode="decimal" defaultValue={millions(query.priceMax)} placeholder={options?.price_max_vnd != null ? millions(options.price_max_vnd) : undefined} /></label>
          </div>
          <label className={styles.single}><span>Diện tích từ · m²</span><input name="dt_min" type="number" min="0" step="1" inputMode="decimal" defaultValue={query.areaMin ?? ''} placeholder={options?.area_min_m2 != null ? String(options.area_min_m2) : undefined} /></label>
        </fieldset>
        <fieldset className={styles.filterGroup}>
          <legend>Loại phòng</legend>
          {types.map(type => <label className={styles.check} key={type}>
            <input type="checkbox" name="loai" value={type} defaultChecked={query.types.includes(type)} />
            <span>{PROPERTY_LABEL[type]}{typeCounts.has(type) && <span className={styles.count}> · {typeCounts.get(type)}</span>}</span>
          </label>)}
        </fieldset>
        <div className={styles.filterGroup}>
          <label className={styles.single}><span>Sắp xếp</span>
            <select name="sap_xep" defaultValue={query.sort}>{(Object.keys(SORT_LABEL) as SortKey[]).map(key => <option key={key} value={key}>{SORT_LABEL[key]}</option>)}</select>
          </label>
          <label className={styles.check}><input type="checkbox" name="ca_khong_thue" value="1" defaultChecked={query.includeNotRental} /><span>Hiện cả bài không phải cho thuê</span></label>
        </div>
      </div>
      <p className={styles.help} role="status">{notice}</p>
      <div className={styles.filterActions}>
        <button className={styles.apply} type="submit" disabled={busy}>Áp dụng</button>
        <button className={styles.clear} type="button" onClick={() => { setNotice(''); onClear(); }} disabled={busy}>Xóa lọc</button>
      </div>
    </details>
  </form>;
}

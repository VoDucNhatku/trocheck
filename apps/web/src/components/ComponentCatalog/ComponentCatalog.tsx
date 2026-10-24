'use client';

import { useState } from 'react';
import type { Fee } from '@/lib/api/types';
import { Button } from '../Button/Button';
import { EntityTag } from '../EntityTag/EntityTag';
import { Field } from '../Field/Field';
import { ListingCard } from '../ListingCard/ListingCard';
import { PriceCompare } from '../PriceCompare/PriceCompare';
import { Receipt } from '../Receipt/Receipt';
import { SiteFooter } from '../SiteFooter/SiteFooter';
import { SiteHeader } from '../SiteHeader/SiteHeader';
import styles from '../shared.module.css';

const fees: Fee[] = [
  { type: 'electricity', amount_vnd: 3500, unit: 'per_kwh' },
  { type: 'water', amount_vnd: 100000, unit: 'per_person_month' },
  { type: 'internet', free: true, unit: 'per_unit_month' },
  { type: 'service', amount_vnd: 180000, unit: 'per_unit_month' },
  { type: 'other', amount_vnd: 45000, unit: 'unknown' },
  { type: 'deposit', months: 1.5, unit: 'months_of_rent' },
];
const data = { title: 'Chung cư mini · Cầu Giấy', propertyType: 'Chung cư mini', rentVnd: 4400000, basis: 'per_unit' as const, areaM2: 25.5, location: 'Dịch Vọng Hậu, Cầu Giấy, Hà Nội', amenities: ['thang máy', 'điều hòa', 'khép kín'], fees };

function Samples({ theme }: { theme: 'light' | 'dark' }) {
  const [message, setMessage] = useState('Chọn một nút để thử tương tác.');
  const [retried, setRetried] = useState(false);
  return <section className={styles.catalogPanel} data-theme={theme} aria-label={`Thành phần chế độ ${theme === 'light' ? 'sáng' : 'tối'}`}>
    <h2>Chế độ {theme === 'light' ? 'sáng' : 'tối'}</h2>
    <h3>Nút và ô nhập</h3>
    <div className={styles.row}>{(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant, index) => <Button key={variant} variant={variant} onClick={() => setMessage(`Đã thử nút ${['chính', 'phụ', 'chữ', 'nguy hiểm'][index]}.`)}>{['Nút chính', 'Nút phụ', 'Nút chữ', 'Nguy hiểm'][index]}</Button>)}</div>
    <div className={styles.row}><Button busy>Đang xử lý</Button><Button disabled>Chưa khả dụng</Button></div>
    <p className={styles.hint} role="status">{message}</p>
    <Field label="Địa danh" name="location" placeholder="Gần trường, tên đường…" hint="Ví dụ: Cầu Giấy, Hà Nội." />
    <Field label="Email (trạng thái lỗi)" type="email" defaultValue="email-chua-dung" error="Nhập địa chỉ email hợp lệ, ví dụ ten@example.com." />
    <h3>Nhãn thực thể</h3>
    <div className={styles.row}><EntityTag label="PRICE">4.400.000 đ</EntityTag><EntityTag label="AREA">25,5 m²</EntityTag><EntityTag label="LOC">Cầu Giấy</EntityTag><EntityTag label="ROOM">Chung cư mini</EntityTag><EntityTag label="FEE">Điện 3.500 đ/số</EntityTag></div>
    <h3>Phiếu đủ dữ liệu</h3><Receipt data={data} />
    <h3>Phiếu thiếu dữ liệu</h3><Receipt data={{}} />
    <h3>Thẻ tin</h3><ListingCard data={{ ...data, href: '/tim-tro', imageLabel: 'Ví dụ tự tạo' }} comparison="Gần giá trung bình của nhóm." />
    <h3>So giá đủ dữ liệu</h3><PriceCompare meanVnd={4000000} targetVnd={4400000} n={14} verdict="higher" deltaPercent={10} group="cùng phường Cầu Giấy, cùng loại và khoảng diện tích" />
    <PriceCompare meanVnd={4000000} targetVnd={3700000} n={14} verdict="lower" deltaPercent={-7.5} />
    <PriceCompare meanVnd={4400000} targetVnd={4400000} n={14} verdict="near" deltaPercent={0} />
    <h3>Chưa đủ dữ liệu</h3><PriceCompare meanVnd={4000000} targetVnd={4400000} n={7} verdict="insufficient" />
    <h3>Trạng thái</h3>
    <div className={styles.state} role="status">Đang tải dữ liệu…</div>
    <div className={styles.state}><h3>Chưa có tin khớp bộ lọc.</h3><p>Thử mở rộng khoảng giá hoặc chọn thêm phường.</p></div>
    <div className={styles.state} data-state={retried ? 'success' : 'error'} role={retried ? 'status' : 'alert'}><h3>{retried ? 'Đã tải lại dữ liệu ví dụ.' : 'Chưa tải được dữ liệu.'}</h3>{!retried && <Button variant="secondary" onClick={() => setRetried(true)}>Thử lại ví dụ</Button>}</div>
    <div className={styles.state} data-state="success" role="status">Đã lưu thay đổi ví dụ.</div>
  </section>;
}

export function ComponentCatalog() {
  const [signedIn, setSignedIn] = useState(false);
  const account = signedIn ? 'tai_khoan_vi_du' : null;
  return <>
    <SiteHeader account={account} />
    <main id="main" className={`container ${styles.catalogPage}`}>
      <div className={styles.catalogIntro}><p className={styles.eyebrow}>Thư viện thành phần · Chỉ dùng khi phát triển</p><h1>Thành phần dùng chung TrọCheck</h1><p>Ví dụ tự tạo. Hai bảng giữ chế độ màu riêng để đối chiếu.</p><div><Button variant="secondary" aria-pressed={signedIn} onClick={() => setSignedIn(value => !value)}>{signedIn ? 'Xem đầu trang khách (mẫu)' : 'Xem đầu trang đã đăng nhập (mẫu)'}</Button></div></div>
      <div className={styles.catalogGrid}><Samples theme="light" /><Samples theme="dark" /></div>
    </main>
    <SiteFooter account={account} />
  </>;
}

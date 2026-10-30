import Link from 'next/link';
import { Suspense } from 'react';
import { ApiState, LoadingState } from '@/components/ApiState/ApiState';
import { errorMessage } from '@/lib/api/http';
import { parseDemo, type SearchParams } from '@/features/listings/filters';
import { ReadingHero } from '@/features/landing/ReadingHero';
import { FeedRibbon, ExtensionPreview } from '@/features/landing/LandingDemos';
import { AtomicText, Mark, Phrase } from '@/features/landing/examples';
import { getHomeMarket } from '@/features/landing/market';
import { getStatsOverview } from '@/lib/api/client';
import { formatDate, formatVnd, PROPERTY_LABEL } from '@/lib/format';
import styles from './landing.module.css';

const PRINCIPLES = [
  ['01 / Thiếu là thiếu', 'Không thấy giá thì để trống. Bài không nói phí thì ghi “Không đề cập”.'],
  ['02 / Có nguồn mới có số', 'Mỗi giá trị phải tìm lại được trong đúng đoạn chữ của bài đăng.'],
  ['03 / Đủ 10 tin mới so', 'Cùng loại, cùng cách tính. Không tự nhân giá theo người thành giá cả phòng.'],
  ['04 / Nhận định trung tính', 'Chỉ nói cao hơn, gần hay thấp hơn mức trung bình. Quyết định thuê là của bạn.'],
];
const CASES = [
  { title: 'Bài không công khai giá', example: <>Phòng <Mark label="Diện tích"><AtomicText text={"25 m²"} /></Mark>, giá ib nhé.</>, body: '“ib giá” là không công khai giá. Không có số 0 thay thế.' },
  { title: 'Giá theo người', example: <>Phòng <Mark label="Diện tích"><AtomicText text={"30 m²"} /></Mark>, <Mark label="Giá">2tr/người/tháng</Mark>.</>, body: 'Không nhân lên. Chỉ so với các tin cũng tính theo người.' },
  { title: 'Giá “từ…”', example: <>Phòng <Mark label="Loại phòng"><AtomicText text={"khép kín"} /></Mark>, <Mark label="Giá">từ 3tr/tháng</Mark>.</>, body: 'Giữ đúng chữ “từ”, chưa đưa vào nhóm so sánh.' },
  { title: 'Hai phòng, hai giá', example: <>P201 <Mark label="Giá">3tr8</Mark>, P302 <Mark label="Giá">4tr9</Mark>.</>, body: 'Tách thành hai tin, không trộn giá giữa hai phòng.' },
  { title: 'Tiền nhà và phí riêng', example: <>Giá <Mark label="Giá">3tr5</Mark>, <Mark label="Phí">điện 3k5/số</Mark>.</>, body: 'Không cộng phí vào giá thuê khi chưa biết lượng sử dụng.' },
  { title: 'Không phải bài cho thuê', example: <>Cần tìm phòng gần <Mark label="Vị trí">ĐH FPT</Mark>, dưới <Phrase><AtomicText text={"3 triệu"} /></Phrase>.</>, body: 'Bài tìm phòng được phân loại riêng, không trích giá cho thuê.' },
];
export const dynamic = 'force-dynamic';
export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const demo = parseDemo(await searchParams);
  const searchHref = `/tim-tro${demo === undefined ? '' : `?demo=${demo}`}`;
  return <div className={styles.landing}>
    <ReadingHero demo={demo} /><FeedRibbon />
    <Suspense fallback={<div className="container"><LoadingState message="Đang tải số liệu kho…" /></div>}><WarehouseStats demo={demo} /></Suspense>
    <section className={`container ${styles.section}`} aria-labelledby="cases-title" id="hard-cases">
      <header className={styles.heading}><div><p className={styles.eyebrow}>Không phải bài nào cũng thẳng thắn</p><h2 id="cases-title">Bài trọ,<br />đủ kiểu viết.</h2></div><p>Sáu ca khó hay gặp. Cách đọc rõ ràng bắt đầu từ việc biết điều gì chưa thể kết luận.</p></header>
      <div className={styles.cases}>{CASES.map(({title,example,body}, i) => <article key={title} className={styles.case}><small>0{i+1} / Ví dụ tự tạo</small><p className={styles.example}>{example}</p><h3><AtomicText text={title} /></h3><p><AtomicText text={body} /></p></article>)}</div>
    </section>
    <section className={`${styles.section} ${styles.band}`} aria-labelledby="extension-title" id="extension"><div className="container">
      <header className={styles.heading}><div><p className={styles.eyebrow}>Extension · Đang phát triển</p><h2 id="extension-title">Nhận định ngay<br /><em>trên Facebook.</em></h2></div><p><AtomicText text={"Chọn bài. Xem trước chữ đã che liên hệ. Đọc giá thuê và phí riêng từng khoản. Các trạng thái dưới đây là ví dụ minh họa."} /></p></header>
      <ExtensionPreview demo={demo} />
      <Link className={styles.secondary} href="/extension">Về trang giới thiệu extension →</Link>
    </div></section>
    <section className={`container ${styles.section} ${styles.market}`} aria-labelledby="market-title"><div><p className={styles.eyebrow}>Một góc thị trường</p><h2 id="market-title">Ít tin,<br />chưa kết luận.</h2><p className={styles.lead}>Đủ dữ liệu mới đưa ra một mức tham khảo. Các ô sọc giữ lại đúng điều chúng ta chưa biết.</p><Link className={styles.secondary} href={`/thi-truong${demo===undefined?'':`?demo=${demo}`}`}>Xem thị trường →</Link></div>
      <Suspense fallback={<LoadingState message="Đang tải giá trung bình…" />}><MarketPreview demo={demo} /></Suspense>
    </section>
    <section className={`${styles.section} ${styles.band}`} aria-labelledby="rules-title" id="nguyen-tac"><div className="container"><p className={styles.eyebrow}>Nguyên tắc đọc tin</p><h2 id="rules-title">Thà nói “chưa biết”<br />còn hơn đoán.</h2><div className={styles.principles}>{PRINCIPLES.map(([title,body]) => <article key={title}><h3><AtomicText text={title} /></h3><p><AtomicText text={body} /></p></article>)}</div></div></section>
    <section className={`container ${styles.section}`} aria-labelledby="check-title" id="extract-check">
      <header className={styles.heading}><div><p className={styles.eyebrow}>Kiểm tra trích xuất</p><h2 id="check-title">Ba cách đọc.<br /><em>Một bài để đối chiếu.</em></h2></div><p>Regex, LLM và nhãn chuẩn do người gán đặt cạnh nhau. Chỗ lệch có lời giải thích, không chỉ một màu đánh dấu.</p></header>
      <p className={styles.eyebrow}>Ví dụ tự tạo</p>
      <div className={styles.layers}>{['Regex','LLM','Nhãn chuẩn'].map((name,i) => <div className={styles.layer} key={name}><b>{name}</b><p><Mark label="Loại phòng">CCMN</Mark> <Mark label="Diện tích"><AtomicText text={"30 m²"} /></Mark> gần {i===0?<Phrase>ĐH FPT</Phrase>:<Mark label="Vị trí">ĐH FPT</Mark>} · <Mark label="Giá">5tr5/tháng</Mark> · <Mark label={i===1?'Giá':'Phí'}>100k/người</Mark></p>{i===1&&<span className={styles.mismatch}>Gán nhầm Giá; đúng là Phí</span>}</div>)}</div>
      <p className={styles.note}><AtomicText text={"Ví dụ tự tạo: LLM gán nhầm “100k/người” thành Giá; nhãn chuẩn là Phí. Regex chưa nhận vị trí “ĐH FPT”."} /></p>
      <p className={styles.note}>Khu kiểm tra dành cho nhóm nghiên cứu; tài khoản cần quyền phù hợp.</p><Link className={styles.secondary} href="/team/kiem-tra">Mở Kiểm tra trích xuất →</Link>
    </section>
    <section className={`container ${styles.section} ${styles.cta}`} aria-labelledby="cta-title"><p className={styles.eyebrow}>Tìm một chốn vừa ý</p><h2 id="cta-title">Tìm phòng theo<br /><em>ngân sách của bạn.</em></h2><div className={styles.actions}><Link href={searchHref} className={styles.primary}>Tìm phòng của bạn →</Link><Link href="/phan-tich" className={styles.secondary}>Đọc bài đăng của bạn →</Link></div></section>
  </div>;
}
async function WarehouseStats({ demo }: { demo?: boolean }) {
  try {
    const stats = await getStatsOverview(demo);
    return <section className={`container ${styles.stats}`} aria-label="Số liệu kho từ API"><span className={styles.badge}>{stats.is_demo?'Dữ liệu demo · Ví dụ':'Dữ liệu kho'}</span>{stats.total_listings > 0 ? <><div><strong>{stats.total_listings.toLocaleString('vi-VN')}</strong><span>tin trong kho</span></div><div><strong>{stats.eligible_listings.toLocaleString('vi-VN')}</strong><span>tin đủ điều kiện thống kê</span></div><div><strong className={styles.date}>{stats.updated_at?formatDate(stats.updated_at):'Chưa rõ ngày'}</strong><span>cập nhật từ API</span></div></>:<p>Kho chưa có tin. Bạn vẫn có thể xem các ví dụ tự tạo trên trang.</p>}</section>;
  } catch(error) { return <div className="container"><ApiState title="Chưa tải được số liệu kho" message={errorMessage(error)} /></div>; }
}
async function MarketPreview({ demo }: { demo?: boolean }) {
  try {
    const data = await getHomeMarket(demo);
    return <div><span className={styles.badge}>{data.is_demo?'Dữ liệu demo · Ví dụ':'Dữ liệu kho'}<AtomicText text={" · Giá trung bình từ API"} /></span>{data.cells.length===0?<p className={styles.empty}>Chưa có nhóm giá. Chưa đủ dữ liệu để nhận định.</p>:<div className={styles.marketRows}>{data.cells.slice(0,6).map((cell,i) => {
      const ready = cell.n>=10 && cell.mean_vnd!=null;
      return <div key={`${cell.ward_code}:${cell.property_type}:${i}`} className={`${styles.marketRow} ${ready?'':styles.striped}`}><div><b><Phrase>{cell.ward_name??'Chưa rõ phường'}</Phrase></b><p>{PROPERTY_LABEL[cell.property_type]} · {cell.n.toLocaleString('vi-VN')} tin</p></div><div>{ready?<><strong><Phrase>{formatVnd(cell.mean_vnd!)}</Phrase></strong><span>/tháng</span></>:<span>Chưa đủ dữ liệu</span>}</div></div>;
    })}</div>}<p className={styles.note}>{data.data_from&&data.data_to?`Dữ liệu ${formatDate(data.data_from)}–${formatDate(data.data_to)}. `:''}<AtomicText text={"Giá chào thuê trong bài đăng, không phải giá giao dịch. Nhóm cùng phường, cùng loại; chưa lọc diện tích."} /></p></div>;
  } catch(error) { return <ApiState title="Chưa tải được giá tham khảo" message={errorMessage(error)} />; }
}

import Link from 'next/link';
import { marketMeanReady, marketSearchUrl } from '@/features/workspace/Market.model';
import { formatDate, formatShort, PROPERTY_LABEL } from '@/lib/format';
import { Phrase } from './examples';
import { getHomeMarket } from './market';
import { SideBlock } from './ScrollReveal';
import styles from './HomeMarket.module.css';

const MAX_ROWS = 6;

/** Small samples and API failures stay visible without invented averages. */
export async function HomeMarket({ demo }: { demo?: boolean }) {
  const market = await getHomeMarket(demo).catch(() => null);
  const rows = market?.cells.slice().sort((a, b) => b.n - a.n).slice(0, MAX_ROWS) ?? [];
  return <section className={`section ${styles.root}`} data-react-section><div className={`wrap ${styles.grid}`}>
    <SideBlock side="left" className={styles.intro}>
      <p className="eyebrow">Thị trường</p>
      <h2 className={styles.title}>Giá thuê <Phrase>trung bình</Phrase> theo phường.</h2>
      <p className={styles.lead}>Xem mức giá chào thuê của các phòng cùng loại trước khi đi hỏi.</p>
      <Link className="btn" href={market ? `/thi-truong?demo=${market.is_demo}` : '/thi-truong'}>Xem thị trường</Link>
    </SideBlock>
    <SideBlock side="right">
      <ul className={styles.rows}>
        {rows.map(cell => <li key={`${cell.ward_code}-${cell.property_type}`}>
          <Link href={marketSearchUrl(cell.ward_name ?? '', cell.property_type, market!.is_demo)}>
            <span className={styles.place}><b>{cell.ward_name}</b><span>{PROPERTY_LABEL[cell.property_type]}</span></span>
            <span className={styles.price}><strong className={!marketMeanReady(cell, market!.min_n) ? styles.insufficient : undefined}>{marketMeanReady(cell, market!.min_n) ? formatShort(cell.mean_vnd) : 'Chưa đủ tin để tính'}</strong><span>{marketMeanReady(cell, market!.min_n) && '/tháng · '}{cell.n} tin</span></span>
          </Link>
        </li>)}
      </ul>
      {!rows.length && <p>{market ? 'Chưa đủ tin để tính giá thuê trung bình.' : 'Chưa tải được giá tham khảo. Hãy thử lại sau.'}</p>}
      <p className={styles.note}>{market?.is_demo && 'Dữ liệu demo. '}{market?.data_to && `Cập nhật ${formatDate(market.data_to)}. `}Giá chào thuê trong bài đăng, không phải giá giao dịch.</p>
    </SideBlock>
  </div></section>;
}

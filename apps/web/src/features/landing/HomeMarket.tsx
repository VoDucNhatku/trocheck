import Link from 'next/link';
import { marketMeanReady, marketSearchUrl } from '@/features/workspace/Market.model';
import { formatDate, formatShort, PROPERTY_LABEL } from '@/lib/format';
import { Phrase } from './examples';
import { getHomeMarket } from './market';
import { SideBlock } from './ScrollReveal';
import styles from './HomeMarket.module.css';

const MAX_ROWS = 6;

/** Real averages only: without data or when the API fails the home page simply skips this section. */
export async function HomeMarket({ demo }: { demo?: boolean }) {
  const market = await getHomeMarket(demo).catch(() => null);
  if (!market) return null;
  const rows = market.cells.filter(cell => marketMeanReady(cell, market.min_n)).sort((a, b) => b.n - a.n).slice(0, MAX_ROWS);
  if (!rows.length) return null;
  return <section className={`section ${styles.root}`} data-react-section><div className={`wrap ${styles.grid}`}>
    <SideBlock side="left" className={styles.intro}>
      <p className="eyebrow">Thị trường</p>
      <h2 className={styles.title}>Giá thuê <Phrase>trung bình</Phrase> theo phường.</h2>
      <p className={styles.lead}>Xem mức giá chào thuê của các phòng cùng loại trước khi đi hỏi.</p>
      <Link className="btn" href={demo === undefined ? '/thi-truong' : `/thi-truong?demo=${demo}`}>Xem thị trường</Link>
    </SideBlock>
    <SideBlock side="right">
      <ul className={styles.rows}>
        {rows.map(cell => <li key={`${cell.ward_code}-${cell.property_type}`}>
          <Link href={marketSearchUrl(cell.ward_name ?? '', cell.property_type, market.is_demo)}>
            <span className={styles.place}><b>{cell.ward_name}</b><span>{PROPERTY_LABEL[cell.property_type]}</span></span>
            <span className={styles.price}><strong>{formatShort(cell.mean_vnd)}</strong><span>/tháng · {cell.n} phòng</span></span>
          </Link>
        </li>)}
      </ul>
      <p className={styles.note}>{market.is_demo && 'Dữ liệu demo. '}{market.data_to && `Cập nhật ${formatDate(market.data_to)}. `}Giá chào thuê trong bài đăng, không phải giá giao dịch.</p>
    </SideBlock>
  </div></section>;
}

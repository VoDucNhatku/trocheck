import type { Rent } from '@/lib/api/types';
import { formatVnd, rentHeadline } from '@/lib/format';
import styles from './RentDisplay.module.css';
type DisplayRent = Pick<Rent, 'visibility' | 'amount_form' | 'amount_vnd' | 'min_vnd' | 'max_vnd' | 'basis' | 'period'>;
export function RentDisplay({ rent, large = false }: { rent: DisplayRent; large?: boolean }) {
  const head = rentHeadline(rent);
  return (
    <span className={styles.rent} data-large={large || undefined} data-missing={head.missing || undefined}>
      <span className="num">
        {rent.amount_form === 'exact' && rent.amount_vnd != null && !head.missing
          ? formatVnd(rent.amount_vnd)
          : head.main}
      </span>
      {head.suffix && <small>{head.suffix}</small>}
    </span>
  );
}

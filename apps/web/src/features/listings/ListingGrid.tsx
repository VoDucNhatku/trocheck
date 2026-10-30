'use client';

import type { ListingCard as Card, Comparison } from '@/lib/api/types';
import { ListingCard } from './ListingCard';
import styles from './ListingGrid.module.css';

/** Keep result geometry stable while API filters and sort change. */
export function ListingGrid({ items, comparisons = {} }: { items: Card[]; comparisons?: Record<string, Comparison | null> }) {
  return (
    <ul className={styles.grid}>
      {items.map((c) => (
        <li key={c.listing_id}>
          <ListingCard card={c} comparison={comparisons[c.listing_id]} />
        </li>
      ))}
    </ul>
  );
}

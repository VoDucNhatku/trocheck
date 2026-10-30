import type { ReactNode } from 'react';
import type { Label } from '@/lib/api/types';
import styles from '../shared.module.css';
import { PhraseText } from '../PhraseText/PhraseText';

const names: Record<Label, string> = { PRICE: 'Giá', AREA: 'Diện tích', LOC: 'Vị trí', ROOM: 'Loại phòng', FEE: 'Phí' };
export function EntityTag({ label, children }: { label: Label; children: ReactNode }) {
  return <mark className={styles.entity} data-entity={label}><span className={styles.entityLabel}>{names[label]}</span><span>{typeof children === 'string' ? <PhraseText text={children} /> : children}</span></mark>;
}

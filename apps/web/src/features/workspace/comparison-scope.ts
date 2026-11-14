import type { components } from '@/lib/api/generated';

type Scoped = Pick<components['schemas']['Comparison'], 'scope' | 'scope_label' | 'pool' | 'reason_codes'>;
type Maybe = Partial<Scoped> | null | undefined;

// Which baseline the API compared with (ADR-0010). Tier 1 is the ward group of accepted listings.
export const POOL_LABEL: Record<NonNullable<Scoped['pool']>, string> = {
  accepted: 'chỉ gồm tin đã duyệt',
  auto_checked: 'gồm tin chưa duyệt, đã qua kiểm tra tự động',
};

export function isDistrictScope(c: Maybe): boolean {
  return c?.scope === 'old_district';
}

/** The always-visible source line. Null for the ward tier, where the sentence already says "cùng phường". */
export function comparisonScopeNote(c: Maybe): string | null {
  if (!c || c.scope !== 'old_district') return null;
  const pool = POOL_LABEL[c.pool ?? 'accepted'] ?? POOL_LABEL.accepted;
  const areaNote = c.reason_codes?.includes('area_band_relaxed') ? ' · mọi diện tích' : '';
  return `So với tin ở ${c.scope_label || 'quận cũ'} · không cùng phường · ${pool}${areaNote}`;
}

/** Place shown in the "Nhóm:" line: the old district for tier 2, otherwise the ward. */
export function comparisonPlace(c: Maybe, wardName: string | null | undefined): string {
  return isDistrictScope(c) ? c?.scope_label || 'Quận cũ' : wardName || 'Chưa rõ phường';
}

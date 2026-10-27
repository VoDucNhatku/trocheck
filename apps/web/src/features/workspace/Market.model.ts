import type { MarketSummary } from '@/lib/workspace/types';
import { PROPERTY_LABEL } from '@/lib/format';

export type MarketCell = MarketSummary['cells'][number];
export type MarketFilters = { ward: string; type: string; basis: 'per_unit' | 'per_person'; demo: 'true' | 'false' };
export const MARKET_TYPES = ['phong_tro', 'ccmn', 'can_ho_dich_vu', 'nha_nguyen_can'] as const;

export function marketFilters(query: Record<string, string | string[] | undefined>): MarketFilters {
  const first = (key: string) => { const value = query[key]; return (Array.isArray(value) ? value[0] : value) ?? ''; };
  const type = first('type');
  return { ward: first('ward').trim(), type: Object.hasOwn(PROPERTY_LABEL, type) ? type : '', basis: first('basis') === 'per_person' ? 'per_person' : 'per_unit', demo: first('demo') === 'false' ? 'false' : 'true' };
}

export function marketQuery(filters: MarketFilters): string {
  const params = new URLSearchParams({ basis: filters.basis, demo: filters.demo });
  if (filters.ward) params.set('ward', filters.ward);
  if (filters.type) params.set('type', filters.type);
  return params.toString();
}

export function marketMinimum(value: number): number {
  return Number.isInteger(value) && value >= 10 ? value : 10;
}

export function marketMeanReady(cell: MarketCell | undefined, minimum = 10): cell is MarketCell & { mean_vnd: number } {
  return !!cell && cell.n >= marketMinimum(minimum) && typeof cell.mean_vnd === 'number' && Number.isFinite(cell.mean_vnd) && cell.mean_vnd > 0;
}

export function marketAreaReady(cell: MarketCell, minimum = 10): cell is MarketCell & { mean_per_m2: number } {
  return cell.n >= marketMinimum(minimum) && cell.n_per_m2 >= marketMinimum(minimum) && typeof cell.mean_per_m2 === 'number' && Number.isFinite(cell.mean_per_m2) && cell.mean_per_m2 > 0;
}

export function marketWards(cells: MarketCell[]) {
  const wards = new Map<string, { key: string; name: string; filter: string; cells: MarketCell[] }>();
  for (const cell of cells) {
    const key = cell.ward_code || cell.ward_name || 'unresolved';
    const ward = wards.get(key) ?? { key, name: cell.ward_name || 'Chưa rõ phường', filter: cell.ward_name || cell.ward_code || '', cells: [] };
    ward.cells.push(cell); wards.set(key, ward);
  }
  return [...wards.values()];
}

export function marketSearchUrl(ward: string, type: string, demo: boolean): string {
  // The public search currently supports ward/type/dataset, but has no basis filter.
  const params = new URLSearchParams({ loai: type, demo: String(demo) });
  if (ward) params.set('phuong', ward);
  return '/tim-tro?' + params.toString();
}

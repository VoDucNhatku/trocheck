// UI-facing names backed by generated API DTOs. Never edit generated.ts by hand.
import type { components } from './generated';
type Schema = components['schemas'];
export type Evidence = Schema['Evidence'];
export type FieldMeta = Pick<Rent, 'decision' | 'abstain_reason' | 'agreement' | 'evidence'>;
export type Rent = Schema['Rent'];
export type Area = Schema['Area'];
export type Room = Schema['Room'];
export type Location = Schema['Location'];
export type Fee = Schema['Fee'];
export type Listing = Schema['Listing'];
export type ListingCard = Schema['ListingCard'];
export type ListingsResponse = Schema['ListingsResponse'];
export type ListingDetail = Schema['ListingDetail'];
export type Comparison = Schema['Comparison'];
export type StatsOverview = Schema['StatsOverview'];
export type Label = Evidence['label'];
export type Method = Evidence['method'];
export type Decision = FieldMeta['decision'];
export type AbstainReason = NonNullable<FieldMeta['abstain_reason']>;
export type Agreement = NonNullable<FieldMeta['agreement']>;
export type FeeType = Fee['type'];
export type PropertyType = ListingCard['property_type'];
export type PostType = NonNullable<ListingDetail['post']['post_type']>;
export type ReviewStatus = Listing['review_status'];
export type Verdict = NonNullable<Comparison['verdict']>;
export type ComparisonReason = Comparison['reason_codes'][number];
export type { MarketCell, MarketSummary } from './prototype-types';

export interface LabRow {
  method: Method;
  evidence: Evidence[];
}

export interface LabToken {
  token: string;
  regex: string;
  llm: string;
  gold: string | null;
}

export interface LabResult {
  post_id: string;
  text: string;
  split: 'dev' | 'test' | null;
  rows: LabRow[];
  tokens: LabToken[];
  normalized: { field: string; regex: string; llm: string; gold: string | null }[];
}

export interface ReviewItem {
  listing_id: string;
  reason: 'conflict' | 'multi_listing' | 'unit_unknown' | 'possible_duplicate' | 'llm_error';
  excerpt: string;
  property_type: PropertyType;
  ward_name: string | null;
  created_at: string;
  version: number;
}

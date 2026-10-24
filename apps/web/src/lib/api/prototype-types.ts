// Archived prototype shapes, only for explicitly labeled illustrations and unused local samples.
// Types mirror spec/schemas/listing-extraction.schema.json and docs/03-system/03-api-contract.md.
// Once the FastAPI OpenAPI exists, replace this file with the generated client types.

export type Label = 'PRICE' | 'AREA' | 'LOC' | 'ROOM' | 'FEE';
export type Method = 'regex' | 'llm' | 'human';

export interface Evidence {
  /** Unicode code point offsets on the stored (phone-masked) text. */
  start: number;
  end: number;
  quote: string;
  label: Label;
  method: Method;
  rule_id?: string;
}

export type Decision = 'answered' | 'abstained' | 'needs_review';
export type AbstainReason =
  | 'not_in_text'
  | 'ambiguous_source'
  | 'conflict'
  | 'llm_error'
  | 'unsupported_format';
export type Agreement = 'both_agree' | 'regex_only' | 'llm_only' | 'conflict' | 'human';

export interface FieldMeta {
  decision: Decision;
  abstain_reason?: AbstainReason;
  agreement?: Agreement;
  evidence?: Evidence[];
}

export type FeeType = 'deposit' | 'electricity' | 'water' | 'service' | 'internet' | 'parking' | 'other';
export type PropertyType = 'phong_tro' | 'ccmn' | 'can_ho_dich_vu' | 'nha_nguyen_can' | 'unknown';
export type PostType = 'rental_offer' | 'seeking' | 'roommate' | 'sale' | 'spam' | 'other';

export interface Rent extends FieldMeta {
  visibility: 'disclosed' | 'hidden_explicit' | 'not_stated' | 'ambiguous';
  amount_form: 'exact' | 'range' | 'starting_from' | 'none';
  amount_vnd?: number | null;
  min_vnd?: number | null;
  max_vnd?: number | null;
  basis: 'per_unit' | 'per_person' | 'unknown';
  period: 'month' | 'day' | 'unknown';
  includes: FeeType[];
}

export interface Area extends FieldMeta {
  amount_form: 'exact' | 'range' | 'none';
  value_m2?: number | null;
  min_m2?: number | null;
  max_m2?: number | null;
  from_dimensions?: boolean;
}

export interface Room extends FieldMeta {
  property_type: PropertyType;
  bedrooms?: number | null;
  bathrooms?: number | null;
  mezzanine?: boolean | null;
  private_bathroom?: boolean | null;
  furnishing: 'full' | 'basic' | 'none' | 'unknown';
}

export interface Location extends FieldMeta {
  landmark?: string | null;
  street?: string | null;
  ward_code?: string | null;
  ward_name?: string | null;
  old_ward_name?: string | null;
  old_district_name?: string | null;
  resolution: 'exact' | 'from_street' | 'from_landmark' | 'unresolved';
}

export interface Fee {
  type: FeeType;
  amount_vnd?: number | null;
  unit: 'per_kwh' | 'per_m3' | 'per_person_month' | 'per_unit_month' | 'months_of_rent' | 'one_time' | 'unknown';
  months?: number | null;
  free?: boolean;
  state_rate?: boolean;
  evidence?: Evidence[];
}

export type ReviewStatus = 'auto_accepted' | 'needs_review' | 'approved' | 'rejected' | 'duplicate';

export interface Listing {
  listing_id: string;
  listing_index: number;
  rent: Rent;
  area: Area;
  room: Room;
  location: Location;
  fees: Fee[];
  review_status: ReviewStatus;
}

export type Verdict = 'higher' | 'near' | 'lower';

/** Item of GET /listings */
export interface ListingCard {
  listing_id: string;
  property_type: PropertyType;
  ward_name: string | null;
  landmark: string | null;
  rent: Pick<Rent, 'visibility' | 'amount_form' | 'amount_vnd' | 'min_vnd' | 'max_vnd' | 'basis' | 'period'>;
  area_m2: number | null;
  fees: Fee[];
  /** null when the collector could not read the post time. */
  posted_at: string | null;
  verdict: Verdict | null;
  delta_percent: number | null;
  /** UI-only, not in the API contract: where this demo row came from. */
  origin: DataOrigin;
  text_complete: boolean;
}

/** `demo` = invented example posts; `extension` = local posts collected by the team's extension (never committed). */
export type DataOrigin = 'demo' | 'extension';

export interface ListingsResponse {
  items: ListingCard[];
  total: number;
  hidden_no_price: number;
  data_as_of: string;
}

export interface ListingDetail {
  listing: Listing;
  post: {
    post_id: string;
    text: string;
    permalink: string | null;
    source_group_name: string | null;
    posted_at: string | null;
    text_complete: boolean;
  };
  sibling_count: number;
  origin: DataOrigin;
}

export type ComparisonReason =
  | 'too_few_samples'
  | 'price_not_exact'
  | 'basis_unknown'
  | 'ward_unresolved'
  | 'area_missing_broad_group';

export interface Comparison {
  status: 'ok' | 'insufficient_data' | 'not_comparable';
  reason_codes: ComparisonReason[];
  criteria: {
    ward_code: string | null;
    ward_name: string | null;
    property_type: PropertyType;
    basis: Rent['basis'];
    area_band: string | null;
    window_days: number;
    broad_group: boolean;
  };
  n: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  n_per_m2: number;
  median_per_m2: number | null;
  delta_percent: number | null;
  verdict: Verdict | null;
  data_from: string;
  data_to: string;
  similar: { listing_id: string; rent_vnd: number; area_m2: number | null }[];
}

export interface MarketCell {
  ward_name: string;
  property_type: PropertyType;
  n: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  median_per_m2: number | null;
  n_per_m2: number;
}

export interface MarketSummary {
  cells: MarketCell[];
  data_from: string;
  data_to: string;
}

export interface StatsOverview {
  total_listings: number;
  eligible_listings: number;
  updated_at: string;
}

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

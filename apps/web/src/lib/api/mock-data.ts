// Demo data for building the UI before the API exists. Every post below is invented
// ("ví dụ tự tạo"); wards are placeholders. Statistics here are hard-coded API *responses* —
// the frontend never computes them (see docs/02-data/05-gop-trung-va-thong-ke.md).

import type {
  Comparison,
  Evidence,
  Fee,
  LabResult,
  Label,
  Listing,
  ListingCard,
  ListingDetail,
  MarketCell,
  Method,
  ReviewItem,
} from './prototype-types';

/** Build an evidence span from a quote, using code point offsets like the API does (demo data only). */
export function ev(text: string, quote: string, label: Label, method: Method = 'human', nth = 0, rule_id?: string): Evidence {
  let from = 0;
  let idx = -1;
  for (let i = 0; i <= nth; i++) {
    idx = text.indexOf(quote, from);
    if (idx < 0) throw new Error(`Quote not found: ${quote}`);
    from = idx + quote.length;
  }
  const start = Array.from(text.slice(0, idx)).length;
  return { start, end: start + Array.from(quote).length, quote, label, method, ...(rule_id ? { rule_id } : {}) };
}

interface Seed {
  id: string;
  text: string;
  group: string;
  posted_at: string;
  ward: string | null;
  build: (t: string) => Omit<Listing, 'listing_id' | 'listing_index' | 'review_status'>;
  comparison: Omit<Comparison, 'criteria' | 'data_from' | 'data_to' | 'similar'> & {
    area_band: string | null;
    similar?: Comparison['similar'];
  };
}

const DATA_FROM = '2026-10-05';
const DATA_TO = '2026-10-25';

const SEEDS: Seed[] = [
  {
    id: 'l-01',
    text: 'Cho thuê CCMN 1PN 30m2 ngay gần ĐH FPT, full nội thất. Giá 5tr5/th/phòng, điện 3k5/số, nước 100k/người, cọc 1 tháng. LH [SĐT]',
    group: 'Phòng trọ gần ĐH FPT (ví dụ)',
    posted_at: '2026-10-21T08:30:00Z',
    ward: 'Xã Hòa Lạc',
    build: (t) => ({
      rent: {
        visibility: 'disclosed', amount_form: 'exact', amount_vnd: 5_500_000, basis: 'per_unit', period: 'month', includes: [],
        decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '5tr5/th/phòng', 'PRICE')],
      },
      area: { amount_form: 'exact', value_m2: 30, from_dimensions: false, decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '30m2', 'AREA')] },
      room: {
        property_type: 'ccmn', bedrooms: 1, furnishing: 'full', decision: 'answered', agreement: 'both_agree',
        evidence: [ev(t, 'CCMN', 'ROOM'), ev(t, '1PN', 'ROOM')],
      },
      location: { landmark: 'gần ĐH FPT', ward_name: 'Xã Hòa Lạc', resolution: 'from_landmark', decision: 'answered', agreement: 'llm_only', evidence: [ev(t, 'gần ĐH FPT', 'LOC')] },
      fees: [
        { type: 'electricity', amount_vnd: 3500, unit: 'per_kwh', evidence: [ev(t, 'điện 3k5/số', 'FEE')] },
        { type: 'water', amount_vnd: 100_000, unit: 'per_person_month', evidence: [ev(t, 'nước 100k/người', 'FEE')] },
        { type: 'deposit', amount_vnd: null, unit: 'months_of_rent', months: 1, evidence: [ev(t, 'cọc 1 tháng', 'FEE')] },
      ],
    }),
    comparison: {
      status: 'ok', reason_codes: [], n: 14, median: 5_000_000, p25: 4_500_000, p75: 5_800_000,
      n_per_m2: 12, median_per_m2: 160_000, delta_percent: 10.0, verdict: 'near', area_band: '[25,35)',
      similar: [
        { listing_id: 'l-04', rent_vnd: 5_200_000, area_m2: 32 },
        { listing_id: 'l-09', rent_vnd: 4_800_000, area_m2: 28 },
        { listing_id: 'l-10', rent_vnd: 5_600_000, area_m2: 30 },
      ],
    },
  },
  {
    id: 'l-02',
    text: 'Cho thuê phòng trọ khép kín 25m2 gần chợ, có gác lửng. Giá ib nhé, điện nước giá nhà nước. LH [SĐT]',
    group: 'Trọ sinh viên Cầu Giấy (ví dụ)',
    posted_at: '2026-10-20T03:10:00Z',
    ward: 'Phường Cầu Giấy',
    build: (t) => ({
      rent: { visibility: 'hidden_explicit', amount_form: 'none', amount_vnd: null, basis: 'unknown', period: 'unknown', includes: [], decision: 'abstained', abstain_reason: 'not_in_text' },
      area: { amount_form: 'exact', value_m2: 25, from_dimensions: false, decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '25m2', 'AREA')] },
      room: {
        property_type: 'phong_tro', mezzanine: true, private_bathroom: true, furnishing: 'unknown', decision: 'answered', agreement: 'both_agree',
        evidence: [ev(t, 'phòng trọ khép kín', 'ROOM'), ev(t, 'gác lửng', 'ROOM')],
      },
      location: { landmark: 'gần chợ', ward_name: null, resolution: 'unresolved', decision: 'answered', agreement: 'llm_only', evidence: [ev(t, 'gần chợ', 'LOC')] },
      fees: [
        { type: 'electricity', amount_vnd: null, unit: 'unknown', state_rate: true, evidence: [ev(t, 'điện nước giá nhà nước', 'FEE')] },
        { type: 'water', amount_vnd: null, unit: 'unknown', state_rate: true },
      ],
    }),
    comparison: {
      status: 'not_comparable', reason_codes: ['price_not_exact', 'ward_unresolved'], n: 0, median: null, p25: null, p75: null,
      n_per_m2: 0, median_per_m2: null, delta_percent: null, verdict: null, area_band: '[20,30)',
    },
  },
  {
    id: 'l-03',
    text: 'Cho thuê phòng 30m2 ở được 2 người, giá 1tr5/người/tháng, wifi free, gửi xe 100k. Gần ĐH Quốc gia. LH [SĐT]',
    group: 'Ở ghép Cầu Giấy (ví dụ)',
    posted_at: '2026-10-19T12:45:00Z',
    ward: 'Phường Cầu Giấy',
    build: (t) => ({
      rent: {
        visibility: 'disclosed', amount_form: 'exact', amount_vnd: 1_500_000, basis: 'per_person', period: 'month', includes: [],
        decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '1tr5/người/tháng', 'PRICE')],
      },
      area: { amount_form: 'exact', value_m2: 30, from_dimensions: false, decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '30m2', 'AREA')] },
      room: { property_type: 'unknown', furnishing: 'unknown', decision: 'answered', agreement: 'regex_only', evidence: [ev(t, 'phòng', 'ROOM')] },
      location: { landmark: 'Gần ĐH Quốc gia', ward_name: 'Phường Cầu Giấy', resolution: 'from_landmark', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Gần ĐH Quốc gia', 'LOC')] },
      fees: [
        { type: 'internet', amount_vnd: 0, unit: 'per_unit_month', free: true, evidence: [ev(t, 'wifi free', 'FEE')] },
        { type: 'parking', amount_vnd: 100_000, unit: 'unknown', evidence: [ev(t, 'gửi xe 100k', 'FEE')] },
      ],
    }),
    comparison: {
      status: 'insufficient_data', reason_codes: ['too_few_samples'], n: 6, median: null, p25: null, p75: null,
      n_per_m2: 5, median_per_m2: null, delta_percent: null, verdict: null, area_band: '[25,35)',
    },
  },
  {
    id: 'l-04',
    text: '🏠 CCMN mới xây 32m2, 1 ngủ 1 khách, ban công thoáng. Ngõ 68 Cầu Giấy. 5tr2/tháng, dịch vụ 150k/phòng, cọc 1 tháng. Xem phòng ib [SĐT]',
    group: 'Trọ sinh viên Cầu Giấy (ví dụ)',
    posted_at: '2026-10-18T09:00:00Z',
    ward: 'Phường Cầu Giấy',
    build: (t) => ({
      rent: {
        visibility: 'disclosed', amount_form: 'exact', amount_vnd: 5_200_000, basis: 'per_unit', period: 'month', includes: [],
        decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '5tr2/tháng', 'PRICE')],
      },
      area: { amount_form: 'exact', value_m2: 32, from_dimensions: false, decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '32m2', 'AREA')] },
      room: { property_type: 'ccmn', bedrooms: 1, furnishing: 'unknown', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'CCMN', 'ROOM'), ev(t, '1 ngủ 1 khách', 'ROOM')] },
      location: { street: 'Ngõ 68 Cầu Giấy', ward_name: 'Phường Cầu Giấy', resolution: 'from_street', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Ngõ 68 Cầu Giấy', 'LOC')] },
      fees: [
        { type: 'service', amount_vnd: 150_000, unit: 'per_unit_month', evidence: [ev(t, 'dịch vụ 150k/phòng', 'FEE')] },
        { type: 'deposit', amount_vnd: null, unit: 'months_of_rent', months: 1, evidence: [ev(t, 'cọc 1 tháng', 'FEE')] },
      ],
    }),
    comparison: {
      status: 'ok', reason_codes: [], n: 18, median: 4_600_000, p25: 4_100_000, p75: 5_100_000,
      n_per_m2: 16, median_per_m2: 150_000, delta_percent: 13.0, verdict: 'higher', area_band: '[25,35)',
      similar: [
        { listing_id: 'l-10', rent_vnd: 5_600_000, area_m2: 30 },
        { listing_id: 'l-06', rent_vnd: 4_300_000, area_m2: 28 },
        { listing_id: 'l-01', rent_vnd: 5_500_000, area_m2: 30 },
      ],
    },
  },
  {
    id: 'l-05',
    text: 'Phòng trọ 20m2 Yên Hòa, có nóng lạnh, điều hoà. Từ 3tr/tháng tuỳ tầng. Điện 4k, nước 30k/khối. LH [SĐT]',
    group: 'Phòng trọ Yên Hòa (ví dụ)',
    posted_at: '2026-10-17T14:20:00Z',
    ward: 'Phường Yên Hòa',
    build: (t) => ({
      rent: {
        visibility: 'disclosed', amount_form: 'starting_from', amount_vnd: null, min_vnd: 3_000_000, basis: 'unknown', period: 'month', includes: [],
        decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Từ 3tr/tháng', 'PRICE')],
      },
      area: { amount_form: 'exact', value_m2: 20, from_dimensions: false, decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '20m2', 'AREA')] },
      room: { property_type: 'phong_tro', furnishing: 'basic', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Phòng trọ', 'ROOM')] },
      location: { ward_name: 'Phường Yên Hòa', resolution: 'exact', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Yên Hòa', 'LOC')] },
      fees: [
        { type: 'electricity', amount_vnd: 4000, unit: 'per_kwh', evidence: [ev(t, 'Điện 4k', 'FEE')] },
        { type: 'water', amount_vnd: 30_000, unit: 'per_m3', evidence: [ev(t, 'nước 30k/khối', 'FEE')] },
      ],
    }),
    comparison: {
      status: 'not_comparable', reason_codes: ['price_not_exact'], n: 11, median: null, p25: null, p75: null,
      n_per_m2: 9, median_per_m2: null, delta_percent: null, verdict: null, area_band: '[15,25)',
    },
  },
  {
    id: 'l-06',
    text: 'Pass phòng trọ 28m2 khép kín, Nghĩa Đô, giá 4tr3 một tháng, điện 3k8, nước 25k/khối, wifi 100k. Còn HĐ 6 tháng. LH [SĐT]',
    group: 'Pass phòng Hà Nội (ví dụ)',
    posted_at: '2026-10-16T07:05:00Z',
    ward: 'Phường Nghĩa Đô',
    build: (t) => ({
      rent: {
        visibility: 'disclosed', amount_form: 'exact', amount_vnd: 4_300_000, basis: 'per_unit', period: 'month', includes: [],
        decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '4tr3 một tháng', 'PRICE')],
      },
      area: { amount_form: 'exact', value_m2: 28, from_dimensions: false, decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '28m2', 'AREA')] },
      room: { property_type: 'phong_tro', private_bathroom: true, furnishing: 'unknown', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'phòng trọ', 'ROOM'), ev(t, 'khép kín', 'ROOM')] },
      location: { ward_name: 'Phường Nghĩa Đô', resolution: 'exact', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Nghĩa Đô', 'LOC')] },
      fees: [
        { type: 'electricity', amount_vnd: 3800, unit: 'per_kwh', evidence: [ev(t, 'điện 3k8', 'FEE')] },
        { type: 'water', amount_vnd: 25_000, unit: 'per_m3', evidence: [ev(t, 'nước 25k/khối', 'FEE')] },
        { type: 'internet', amount_vnd: 100_000, unit: 'per_unit_month', evidence: [ev(t, 'wifi 100k', 'FEE')] },
      ],
    }),
    comparison: {
      status: 'ok', reason_codes: [], n: 12, median: 3_400_000, p25: 3_075_000, p75: 3_650_000,
      n_per_m2: 11, median_per_m2: 135_000, delta_percent: 26.5, verdict: 'higher', area_band: '[25,35)',
      similar: [
        { listing_id: 'l-08', rent_vnd: 3_500_000, area_m2: 26 },
        { listing_id: 'l-11', rent_vnd: 3_300_000, area_m2: 27 },
        { listing_id: 'l-12', rent_vnd: 3_800_000, area_m2: 30 },
      ],
    },
  },
  {
    id: 'l-07',
    text: 'Còn 2 phòng: P201 25m2 giá 3tr8/th, P302 35m2 giá 4tr9/th, đều có ban công. Ngõ 12 Trần Thái Tông. Điện 3k5/số. LH [SĐT]',
    group: 'Trọ sinh viên Cầu Giấy (ví dụ)',
    posted_at: '2026-10-15T10:30:00Z',
    ward: 'Phường Cầu Giấy',
    build: (t) => ({
      rent: {
        visibility: 'disclosed', amount_form: 'exact', amount_vnd: 3_800_000, basis: 'per_unit', period: 'month', includes: [],
        decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'giá 3tr8/th', 'PRICE')],
      },
      area: { amount_form: 'exact', value_m2: 25, from_dimensions: false, decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '25m2', 'AREA')] },
      room: { property_type: 'phong_tro', furnishing: 'unknown', decision: 'answered', agreement: 'llm_only', evidence: [ev(t, 'P201', 'ROOM')] },
      location: { street: 'Ngõ 12 Trần Thái Tông', ward_name: 'Phường Cầu Giấy', resolution: 'from_street', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Ngõ 12 Trần Thái Tông', 'LOC')] },
      fees: [{ type: 'electricity', amount_vnd: 3500, unit: 'per_kwh', evidence: [ev(t, 'Điện 3k5/số', 'FEE')] }],
    }),
    comparison: {
      status: 'ok', reason_codes: [], n: 15, median: 3_900_000, p25: 3_500_000, p75: 4_300_000,
      n_per_m2: 13, median_per_m2: 150_000, delta_percent: -2.6, verdict: 'near', area_band: '[20,30)',
      similar: [
        { listing_id: 'l-06', rent_vnd: 4_300_000, area_m2: 28 },
        { listing_id: 'l-08', rent_vnd: 3_500_000, area_m2: 26 },
        { listing_id: 'l-11', rent_vnd: 3_300_000, area_m2: 27 },
      ],
    },
  },
  {
    id: 'l-08',
    text: 'Phòng 26m2 khép kín gần ĐH Sư phạm, 3tr5/tháng bao nước, điện 3k5. Cọc 1 tháng. LH [SĐT]',
    group: 'Phòng trọ Cầu Giấy (ví dụ)',
    posted_at: '2026-10-14T02:15:00Z',
    ward: 'Phường Cầu Giấy',
    build: (t) => ({
      rent: {
        visibility: 'disclosed', amount_form: 'exact', amount_vnd: 3_500_000, basis: 'per_unit', period: 'month', includes: ['water'],
        decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '3tr5/tháng', 'PRICE')],
      },
      area: { amount_form: 'exact', value_m2: 26, from_dimensions: false, decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '26m2', 'AREA')] },
      room: { property_type: 'phong_tro', private_bathroom: true, furnishing: 'unknown', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'khép kín', 'ROOM')] },
      location: { landmark: 'gần ĐH Sư phạm', ward_name: 'Phường Cầu Giấy', resolution: 'from_landmark', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'gần ĐH Sư phạm', 'LOC')] },
      fees: [
        { type: 'water', amount_vnd: null, unit: 'unknown', evidence: [ev(t, 'bao nước', 'FEE')] },
        { type: 'electricity', amount_vnd: 3500, unit: 'per_kwh', evidence: [ev(t, 'điện 3k5', 'FEE')] },
        { type: 'deposit', amount_vnd: null, unit: 'months_of_rent', months: 1, evidence: [ev(t, 'Cọc 1 tháng', 'FEE')] },
      ],
    }),
    comparison: {
      status: 'ok', reason_codes: [], n: 15, median: 3_900_000, p25: 3_500_000, p75: 4_300_000,
      n_per_m2: 13, median_per_m2: 150_000, delta_percent: -10.3, verdict: 'lower', area_band: '[20,30)',
      similar: [
        { listing_id: 'l-07', rent_vnd: 3_800_000, area_m2: 25 },
        { listing_id: 'l-11', rent_vnd: 3_300_000, area_m2: 27 },
        { listing_id: 'l-06', rent_vnd: 4_300_000, area_m2: 28 },
      ],
    },
  },
  {
    id: 'l-09',
    text: 'CCMN 28m2 Thạch Hòa, gần FPT, 4tr8/th, full đồ, máy giặt chung. Điện 3k5, nước 80k/ng. LH [SĐT]',
    group: 'Phòng trọ gần ĐH FPT (ví dụ)',
    posted_at: '2026-10-13T11:40:00Z',
    ward: 'Xã Hòa Lạc',
    build: (t) => ({
      rent: {
        visibility: 'disclosed', amount_form: 'exact', amount_vnd: 4_800_000, basis: 'per_unit', period: 'month', includes: [],
        decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '4tr8/th', 'PRICE')],
      },
      area: { amount_form: 'exact', value_m2: 28, from_dimensions: false, decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '28m2', 'AREA')] },
      room: { property_type: 'ccmn', furnishing: 'full', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'CCMN', 'ROOM')] },
      location: { landmark: 'gần FPT', old_ward_name: 'Thạch Hòa', ward_name: 'Xã Hòa Lạc', resolution: 'exact', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Thạch Hòa', 'LOC'), ev(t, 'gần FPT', 'LOC')] },
      fees: [
        { type: 'electricity', amount_vnd: 3500, unit: 'per_kwh', evidence: [ev(t, 'Điện 3k5', 'FEE')] },
        { type: 'water', amount_vnd: 80_000, unit: 'per_person_month', evidence: [ev(t, 'nước 80k/ng', 'FEE')] },
      ],
    }),
    comparison: {
      status: 'ok', reason_codes: [], n: 14, median: 5_000_000, p25: 4_500_000, p75: 5_800_000,
      n_per_m2: 12, median_per_m2: 160_000, delta_percent: -4.0, verdict: 'near', area_band: '[25,35)',
      similar: [
        { listing_id: 'l-01', rent_vnd: 5_500_000, area_m2: 30 },
        { listing_id: 'l-10', rent_vnd: 5_600_000, area_m2: 30 },
        { listing_id: 'l-04', rent_vnd: 5_200_000, area_m2: 32 },
      ],
    },
  },
  {
    id: 'l-10',
    text: 'Căn hộ dịch vụ 30m2 full nội thất, có thang máy, Dịch Vọng Hậu. Giá 5tr6/tháng đã bao dịch vụ, internet. Điện 4k/số. LH [SĐT]',
    group: 'Căn hộ dịch vụ Cầu Giấy (ví dụ)',
    posted_at: '2026-10-12T09:00:00Z',
    ward: 'Phường Cầu Giấy',
    build: (t) => ({
      rent: {
        visibility: 'disclosed', amount_form: 'exact', amount_vnd: 5_600_000, basis: 'per_unit', period: 'month', includes: ['service', 'internet'],
        decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '5tr6/tháng', 'PRICE')],
      },
      area: { amount_form: 'exact', value_m2: 30, from_dimensions: false, decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '30m2', 'AREA')] },
      room: { property_type: 'can_ho_dich_vu', furnishing: 'full', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Căn hộ dịch vụ', 'ROOM')] },
      location: { street: 'Dịch Vọng Hậu', ward_name: 'Phường Cầu Giấy', resolution: 'from_street', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Dịch Vọng Hậu', 'LOC')] },
      fees: [
        { type: 'service', amount_vnd: null, unit: 'unknown', evidence: [ev(t, 'đã bao dịch vụ, internet', 'FEE')] },
        { type: 'electricity', amount_vnd: 4000, unit: 'per_kwh', evidence: [ev(t, 'Điện 4k/số', 'FEE')] },
      ],
    }),
    comparison: {
      status: 'insufficient_data', reason_codes: ['too_few_samples'], n: 7, median: null, p25: null, p75: null,
      n_per_m2: 7, median_per_m2: null, delta_percent: null, verdict: null, area_band: '[25,35)',
    },
  },
  {
    id: 'l-11',
    text: 'Phòng trọ 27m2 Nghĩa Đô, giá 3tr3/tháng, khép kín, để xe miễn phí. Điện 3k5, nước 100k/người. LH [SĐT]',
    group: 'Phòng trọ Nghĩa Đô (ví dụ)',
    posted_at: '2026-10-10T15:30:00Z',
    ward: 'Phường Nghĩa Đô',
    build: (t) => ({
      rent: {
        visibility: 'disclosed', amount_form: 'exact', amount_vnd: 3_300_000, basis: 'per_unit', period: 'month', includes: [],
        decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '3tr3/tháng', 'PRICE')],
      },
      area: { amount_form: 'exact', value_m2: 27, from_dimensions: false, decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '27m2', 'AREA')] },
      room: { property_type: 'phong_tro', private_bathroom: true, furnishing: 'unknown', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Phòng trọ', 'ROOM'), ev(t, 'khép kín', 'ROOM')] },
      location: { ward_name: 'Phường Nghĩa Đô', resolution: 'exact', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Nghĩa Đô', 'LOC')] },
      fees: [
        { type: 'parking', amount_vnd: 0, unit: 'unknown', free: true, evidence: [ev(t, 'để xe miễn phí', 'FEE')] },
        { type: 'electricity', amount_vnd: 3500, unit: 'per_kwh', evidence: [ev(t, 'Điện 3k5', 'FEE')] },
        { type: 'water', amount_vnd: 100_000, unit: 'per_person_month', evidence: [ev(t, 'nước 100k/người', 'FEE')] },
      ],
    }),
    comparison: {
      status: 'ok', reason_codes: [], n: 12, median: 3_400_000, p25: 3_075_000, p75: 3_650_000,
      n_per_m2: 11, median_per_m2: 135_000, delta_percent: -2.9, verdict: 'near', area_band: '[25,35)',
      similar: [
        { listing_id: 'l-06', rent_vnd: 4_300_000, area_m2: 28 },
        { listing_id: 'l-08', rent_vnd: 3_500_000, area_m2: 26 },
        { listing_id: 'l-12', rent_vnd: 3_800_000, area_m2: 30 },
      ],
    },
  },
  {
    id: 'l-12',
    text: 'Nhà nguyên căn 3 tầng 40m2/sàn, 3PN, ngõ ô tô, Yên Hòa. 12tr/tháng, cọc 2 tháng, ký HĐ 1 năm. LH [SĐT]',
    group: 'Nhà nguyên căn Hà Nội (ví dụ)',
    posted_at: '2026-10-08T06:00:00Z',
    ward: 'Phường Yên Hòa',
    build: (t) => ({
      rent: {
        visibility: 'disclosed', amount_form: 'exact', amount_vnd: 12_000_000, basis: 'per_unit', period: 'month', includes: [],
        decision: 'answered', agreement: 'both_agree', evidence: [ev(t, '12tr/tháng', 'PRICE')],
      },
      area: { amount_form: 'exact', value_m2: 40, from_dimensions: false, decision: 'needs_review', agreement: 'conflict', evidence: [ev(t, '40m2/sàn', 'AREA')] },
      room: { property_type: 'nha_nguyen_can', bedrooms: 3, furnishing: 'unknown', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Nhà nguyên căn', 'ROOM'), ev(t, '3PN', 'ROOM')] },
      location: { ward_name: 'Phường Yên Hòa', resolution: 'exact', decision: 'answered', agreement: 'both_agree', evidence: [ev(t, 'Yên Hòa', 'LOC')] },
      fees: [{ type: 'deposit', amount_vnd: null, unit: 'months_of_rent', months: 2, evidence: [ev(t, 'cọc 2 tháng', 'FEE')] }],
    }),
    comparison: {
      status: 'insufficient_data', reason_codes: ['too_few_samples'], n: 3, median: null, p25: null, p75: null,
      n_per_m2: 2, median_per_m2: null, delta_percent: null, verdict: null, area_band: '[35,50)',
    },
  },
];

function toListing(s: Seed): Listing {
  return { listing_id: s.id, listing_index: 0, review_status: 'approved', ...s.build(s.text) };
}

export const LISTINGS: Listing[] = SEEDS.map(toListing);

export const DETAILS: Record<string, ListingDetail> = Object.fromEntries(
  SEEDS.map((s) => [
    s.id,
    {
      listing: toListing(s),
      post: {
        post_id: `p-${s.id.slice(2)}`,
        text: s.text,
        permalink: null,
        source_group_name: s.group,
        posted_at: s.posted_at,
        text_complete: true,
      },
      sibling_count: 0,
      origin: 'demo',
    } satisfies ListingDetail,
  ]),
);

export const COMPARISONS: Record<string, Comparison> = Object.fromEntries(
  SEEDS.map((s) => {
    const l = toListing(s);
    const { area_band, similar, ...rest } = s.comparison;
    return [
      s.id,
      {
        ...rest,
        criteria: {
          ward_code: null,
          ward_name: s.ward,
          property_type: l.room.property_type,
          basis: l.rent.basis,
          area_band,
          window_days: 30,
          broad_group: false,
        },
        data_from: DATA_FROM,
        data_to: DATA_TO,
        similar: similar ?? [],
      } satisfies Comparison,
    ];
  }),
);

export const CARDS: ListingCard[] = SEEDS.map((s) => {
  const l = toListing(s);
  const c = COMPARISONS[s.id];
  return {
    listing_id: s.id,
    property_type: l.room.property_type,
    ward_name: l.location.ward_name ?? null,
    landmark: l.location.landmark ?? l.location.street ?? null,
    rent: {
      visibility: l.rent.visibility,
      amount_form: l.rent.amount_form,
      amount_vnd: l.rent.amount_vnd,
      min_vnd: l.rent.min_vnd,
      max_vnd: l.rent.max_vnd,
      basis: l.rent.basis,
      period: l.rent.period,
    },
    area_m2: l.area.value_m2 ?? null,
    fees: l.fees,
    posted_at: s.posted_at,
    verdict: c.verdict,
    delta_percent: c.delta_percent,
    origin: 'demo',
    text_complete: true,
  };
});

export const MARKET: MarketCell[] = [
  { ward_name: 'Phường Cầu Giấy', property_type: 'phong_tro', n: 15, median: 3_900_000, p25: 3_500_000, p75: 4_300_000, median_per_m2: 150_000, n_per_m2: 13 },
  { ward_name: 'Phường Cầu Giấy', property_type: 'ccmn', n: 18, median: 4_600_000, p25: 4_100_000, p75: 5_100_000, median_per_m2: 150_000, n_per_m2: 16 },
  { ward_name: 'Phường Cầu Giấy', property_type: 'can_ho_dich_vu', n: 7, median: null, p25: null, p75: null, median_per_m2: null, n_per_m2: 7 },
  { ward_name: 'Phường Nghĩa Đô', property_type: 'phong_tro', n: 12, median: 3_400_000, p25: 3_075_000, p75: 3_650_000, median_per_m2: 135_000, n_per_m2: 11 },
  { ward_name: 'Phường Nghĩa Đô', property_type: 'ccmn', n: 9, median: null, p25: null, p75: null, median_per_m2: null, n_per_m2: 8 },
  { ward_name: 'Phường Yên Hòa', property_type: 'phong_tro', n: 11, median: 3_100_000, p25: 2_800_000, p75: 3_500_000, median_per_m2: 140_000, n_per_m2: 9 },
  { ward_name: 'Phường Yên Hòa', property_type: 'nha_nguyen_can', n: 3, median: null, p25: null, p75: null, median_per_m2: null, n_per_m2: 2 },
  { ward_name: 'Xã Hòa Lạc', property_type: 'ccmn', n: 14, median: 5_000_000, p25: 4_500_000, p75: 5_800_000, median_per_m2: 160_000, n_per_m2: 12 },
  { ward_name: 'Xã Hòa Lạc', property_type: 'phong_tro', n: 10, median: 2_500_000, p25: 2_200_000, p75: 2_900_000, median_per_m2: 125_000, n_per_m2: 10 },
];

export const MARKET_RANGE = { data_from: DATA_FROM, data_to: DATA_TO };

export const OVERVIEW = { total_listings: 412, eligible_listings: 298, updated_at: '2026-10-25T09:00:00Z' };

/* ---------------- Lab ---------------- */

const LAB_TEXT = SEEDS[0].text;

function bio(text: string, spans: Evidence[]): { token: string; tag: string }[] {
  // Whitespace tokenization on code points, enough for the demo table.
  const chars = Array.from(text);
  const out: { token: string; tag: string }[] = [];
  let i = 0;
  while (i < chars.length) {
    if (/\s/.test(chars[i])) {
      i++;
      continue;
    }
    const start = i;
    while (i < chars.length && !/\s/.test(chars[i])) i++;
    const token = chars.slice(start, i).join('');
    const span = spans.find((s) => start >= s.start && start < s.end);
    out.push({ token, tag: span ? `${start === span.start ? 'B' : 'I'}-${span.label}` : 'O' });
  }
  return out;
}

const gold = DETAILS['l-01'].listing;
const goldSpans: Evidence[] = [
  ...(gold.rent.evidence ?? []),
  ...(gold.area.evidence ?? []),
  ...(gold.room.evidence ?? []),
  ...(gold.location.evidence ?? []),
  ...gold.fees.flatMap((f) => f.evidence ?? []),
];

const regexSpans: Evidence[] = [
  ev(LAB_TEXT, 'CCMN', 'ROOM', 'regex', 0, 'ROOM_TYPE_DICT'),
  ev(LAB_TEXT, '1PN', 'ROOM', 'regex', 0, 'ROOM_PN'),
  ev(LAB_TEXT, '30m2', 'AREA', 'regex', 0, 'AREA_M2'),
  ev(LAB_TEXT, '5tr5/th/phòng', 'PRICE', 'regex', 0, 'PRICE_TR_SUFFIX'),
  ev(LAB_TEXT, 'điện 3k5/số', 'FEE', 'regex', 0, 'FEE_ELEC_K'),
  ev(LAB_TEXT, 'nước 100k/người', 'FEE', 'regex', 0, 'FEE_WATER_K'),
  ev(LAB_TEXT, 'cọc 1 tháng', 'FEE', 'regex', 0, 'FEE_DEPOSIT_MONTH'),
];

const llmSpans: Evidence[] = [
  ev(LAB_TEXT, 'CCMN 1PN', 'ROOM', 'llm'),
  ev(LAB_TEXT, '30m2', 'AREA', 'llm'),
  ev(LAB_TEXT, 'gần ĐH FPT', 'LOC', 'llm'),
  ev(LAB_TEXT, '5tr5/th/phòng', 'PRICE', 'llm'),
  ev(LAB_TEXT, 'điện 3k5/số', 'FEE', 'llm'),
  ev(LAB_TEXT, '100k/người', 'PRICE', 'llm'),
  ev(LAB_TEXT, 'cọc 1 tháng', 'FEE', 'llm'),
];

const bGold = bio(LAB_TEXT, goldSpans);
const bRegex = bio(LAB_TEXT, regexSpans);
const bLlm = bio(LAB_TEXT, llmSpans);

export const LAB: LabResult = {
  post_id: 'p-01',
  text: LAB_TEXT,
  split: 'dev',
  rows: [
    { method: 'regex', evidence: regexSpans },
    { method: 'llm', evidence: llmSpans },
    { method: 'human', evidence: goldSpans },
  ],
  tokens: bGold.map((g, i) => ({ token: g.token, regex: bRegex[i].tag, llm: bLlm[i].tag, gold: g.tag })),
  normalized: [
    { field: 'rent.amount_vnd', regex: '5.500.000', llm: '5.500.000', gold: '5.500.000' },
    { field: 'rent.basis', regex: 'per_unit', llm: 'per_unit', gold: 'per_unit' },
    { field: 'area.value_m2', regex: '30', llm: '30', gold: '30' },
    { field: 'location.landmark', regex: '—', llm: 'gần ĐH FPT', gold: 'gần ĐH FPT' },
    { field: 'fees.water', regex: '100.000 /người/tháng', llm: '— (gán nhầm PRICE)', gold: '100.000 /người/tháng' },
    { field: 'fees.deposit.months', regex: '1', llm: '1', gold: '1' },
  ],
};

/* ---------------- Review queue ---------------- */

export const REVIEWS: ReviewItem[] = [
  { listing_id: 'l-12', reason: 'conflict', excerpt: 'Nhà nguyên căn 3 tầng 40m2/sàn, 3PN…', property_type: 'nha_nguyen_can', ward_name: 'Phường Yên Hòa', created_at: '2026-10-25T07:40:00Z', version: 2 },
  { listing_id: 'l-07', reason: 'multi_listing', excerpt: 'Còn 2 phòng: P201 25m2 giá 3tr8, P302 35m2…', property_type: 'phong_tro', ward_name: 'Phường Cầu Giấy', created_at: '2026-10-25T06:10:00Z', version: 1 },
  { listing_id: 'l-05', reason: 'unit_unknown', excerpt: 'Phòng trọ 20m2 Yên Hòa… Từ 3tr/tháng tuỳ tầng', property_type: 'phong_tro', ward_name: 'Phường Yên Hòa', created_at: '2026-10-24T22:00:00Z', version: 1 },
  { listing_id: 'l-09', reason: 'possible_duplicate', excerpt: 'CCMN 28m2 Thạch Hòa, gần FPT, 4tr8/th…', property_type: 'ccmn', ward_name: 'Xã Hòa Lạc', created_at: '2026-10-24T18:30:00Z', version: 3 },
  { listing_id: 'l-03', reason: 'llm_error', excerpt: 'Cho thuê phòng 30m2 ở được 2 người, giá 1tr5/người…', property_type: 'unknown', ward_name: 'Phường Cầu Giấy', created_at: '2026-10-24T15:05:00Z', version: 1 },
];

export type { Fee };

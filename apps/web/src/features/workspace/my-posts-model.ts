import type { components } from '@/lib/api/generated';
type DTO = components['schemas'];
export type MyPost = DTO['MyPost'];
export type MyPostsData = DTO['MyPosts'];
export type MyPostsSummary = DTO['MyPostsSummary'];
export type ExtractedListing = DTO['ExtractedListing'];
export type StatusGroup = 'all' | 'published' | 'waiting' | 'other';

export const STATUS_LABEL: Record<MyPost['status'], string> = {
  received: 'Đang xử lý', needs_review: 'Đang chờ duyệt', published: 'Đã công khai',
  rejected: 'Không được duyệt', not_rental: 'Không phải tin cho thuê', failed: 'Xử lý gặp lỗi',
};
export const GROUP_LABEL: Record<StatusGroup, string> = {
  all: 'Tất cả', published: 'Đã công khai', waiting: 'Đang xử lý / chờ duyệt', other: 'Không đăng / gặp lỗi',
};
const REASONS: Record<string, string> = {
  basis_unknown: 'Giá chưa rõ tính theo phòng hay người',
  former_ward_split: 'Phường cũ được chia vào nhiều phường mới, cần xác định lại',
  former_ward_ambiguous: 'Tên phường cũ chưa đủ rõ để xác định phường mới',
  former_ward_unresolved: 'Chưa xác định được phường mới từ phường cũ',
  outside_hcm_province: 'Vị trí nằm ngoài phạm vi Thành phố Hồ Chí Minh',
  former_district_unverified: 'Cần xác minh vị trí theo quận cũ',
  multi_listing: 'Bài có nhiều phòng hoặc nhiều mức giá cần đối chiếu',
  conflict: 'Các thông tin trích xuất chưa thống nhất',
  llm_error: 'Chưa hoàn tất việc đọc thông tin, cần kiểm tra lại',
  possible_duplicate: 'Cần kiểm tra bài có trùng với tin đã có hay không',
};

export function statusExplanation(post: MyPost): string {
  if (post.status === 'received') return 'Máy chủ đã nhận bài và đang chờ hoàn tất xử lý.';
  if (post.status === 'published') return 'Bài có tin đã được công khai trong kho tìm trọ.';
  if (post.status === 'not_rental') return 'Nội dung được phân loại không phải bài chào thuê.';
  if (post.status === 'failed') return 'Máy chủ chưa xử lý được bài sau các lần thử.';
  if (post.status === 'rejected') return 'Tin đã bị từ chối hoặc được đánh dấu trùng khi duyệt.';
  const reason = post.reason_codes.map(code => REASONS[code]).find(Boolean);
  if (reason) return reason + '.';
  if (post.listings.some(lst => !lst.ward_code)) return 'Chưa rõ phường.';
  if (post.listings.some(lst => lst.price_basis === 'unknown')) return REASONS.basis_unknown + '.';
  return 'Cần người duyệt đối chiếu thông tin trước khi công khai.';
}

export function comparisonText(c: ExtractedListing['comparison']): string {
  if (c.status === 'insufficient_data') return `Chưa đủ tin trong khu vực để so (${c.n} tin tương tự).`;
  // The existing service compares against the mean, not the median. Keep its exact message.
  return c.message;
}

export function safeOriginalLink(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

// --- Filters kept in the page URL (shareable, survive reload) -------------------------------
export type MyPostsFilters = DTO['MyPostsFilters'];
export type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'area_desc';
export const SORT_LABEL: Record<SortKey, string> = {
  newest: 'Mới gửi nhất', price_asc: 'Giá thấp đến cao', price_desc: 'Giá cao đến thấp', area_desc: 'Diện tích lớn nhất',
};
export const FILTER_ROOM_TYPES = ['phong_tro', 'ccmn', 'can_ho_dich_vu', 'nha_nguyen_can'] as const;
const ROOM_TYPES: readonly string[] = [...FILTER_ROOM_TYPES, 'unknown'];

export type MyPostsQuery = {
  group: StatusGroup; page: number; areas: string[]; types: string[];
  priceMin?: number; priceMax?: number; areaMin?: number;   // priceMin/priceMax in VND per month, areaMin in m²
  sort: SortKey; includeNotRental: boolean;
};
export const DEFAULT_QUERY: MyPostsQuery = { group: 'all', page: 1, areas: [], types: [], sort: 'newest', includeNotRental: false };

const GROUPS: StatusGroup[] = ['all', 'published', 'waiting', 'other'];
const SORTS: SortKey[] = ['newest', 'price_asc', 'price_desc', 'area_desc'];
const AREA_KEY = /^[a-z0-9-]{1,40}$/;
const number = (value: string | null): number | undefined => {
  if (value == null || value.trim() === '') return undefined;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};
const unique = (values: string[]) => [...new Set(values)];

/** Prices in the URL are in million VND (gia_max=5 means 5.000.000 đ/tháng); bad values are dropped. */
export function parseMyPostsQuery(input: string | URLSearchParams): MyPostsQuery {
  const params = typeof input === 'string' ? new URLSearchParams(input) : input;
  const group = params.get('nhom') as StatusGroup;
  const sort = params.get('sap_xep') as SortKey;
  const million = (key: string) => { const value = number(params.get(key)); return value == null ? undefined : Math.round(value * 1_000_000); };
  let priceMin = million('gia_min'), priceMax = million('gia_max');
  if (priceMin != null && priceMax != null && priceMin > priceMax) priceMax = undefined;
  const page = number(params.get('trang'));
  const query: MyPostsQuery = {
    group: GROUPS.includes(group) ? group : 'all',
    page: Math.max(1, Math.floor(page ?? 1)),
    areas: unique(params.getAll('khu_vuc').filter(key => AREA_KEY.test(key))),
    types: unique(params.getAll('loai').filter(type => ROOM_TYPES.includes(type))),
    sort: SORTS.includes(sort) ? sort : 'newest',
    includeNotRental: params.get('ca_khong_thue') === '1',
  };
  const areaMin = number(params.get('dt_min'));
  if (priceMin != null) query.priceMin = priceMin;
  if (priceMax != null) query.priceMax = priceMax;
  if (areaMin != null) query.areaMin = areaMin;
  return query;
}

const trimmed = (value: number) => String(Math.round(value * 100) / 100);

/** Query string for the page URL: defaults are omitted so a clean page has a clean address. */
export function myPostsUrlQuery(q: MyPostsQuery): string {
  const params = new URLSearchParams();
  if (q.group !== 'all') params.set('nhom', q.group);
  for (const key of q.areas) params.append('khu_vuc', key);
  if (q.priceMin != null) params.set('gia_min', trimmed(q.priceMin / 1_000_000));
  if (q.priceMax != null) params.set('gia_max', trimmed(q.priceMax / 1_000_000));
  if (q.areaMin != null) params.set('dt_min', trimmed(q.areaMin));
  for (const type of q.types) params.append('loai', type);
  if (q.sort !== 'newest') params.set('sap_xep', q.sort);
  if (q.includeNotRental) params.set('ca_khong_thue', '1');
  if (q.page > 1) params.set('trang', String(q.page));
  return params.toString();
}

/** Query string for GET /me/posts. */
export function myPostsApiQuery(q: MyPostsQuery, limit = 20): string {
  const params = new URLSearchParams({ group: q.group, page: String(q.page), limit: String(limit) });
  for (const key of q.areas) params.append('area', key);
  for (const type of q.types) params.append('type', type);
  if (q.priceMin != null) params.set('price_min', String(q.priceMin));
  if (q.priceMax != null) params.set('price_max', String(q.priceMax));
  if (q.areaMin != null) params.set('area_min', String(q.areaMin));
  params.set('sort', q.sort);
  params.set('rental_only', String(!q.includeNotRental));
  return params.toString();
}

/** Filters that narrow listings (status tab, sort and the not-rental toggle are not counted). */
export function activeFilterCount(q: MyPostsQuery): number {
  return q.areas.length + q.types.length + [q.priceMin, q.priceMax, q.areaMin].filter(v => v != null).length;
}
export const hasAnyFilter = (q: MyPostsQuery) => activeFilterCount(q) > 0 || q.includeNotRental || q.sort !== 'newest';

export function areaLabel(name: string): string { return `${name} (cũ)`; }

/** How a listing matched the area filter: the resolved ward, a district the post names, or an ad listing many districts. */
export const AREA_MATCH_LABEL: Record<NonNullable<ExtractedListing['area_match']>, string> = {
  ward: 'Ở đúng phường', mention: 'Bài nhắc tên quận', multi_area: 'Bài nhiều khu vực',
};
export function areaMatchLabel(match: ExtractedListing['area_match'] | undefined): string | null {
  return match ? AREA_MATCH_LABEL[match] ?? null : null;
}

/** Where the place comes from: the ward when known, else the old district the post names. */
export function placeText(listing: Pick<ExtractedListing, 'ward_name' | 'old_districts'>): string {
  if (listing.ward_name) return listing.ward_name;
  const named = (listing.old_districts ?? []).map(d => areaLabel(d.name));
  return named.length ? `${named.join(', ')} · chưa rõ phường` : 'Chưa rõ phường';
}

/** "12 phòng khớp trong 200 bài đã gửi" as separate phrases so the page never breaks inside one. */
export function resultPhrases(data: Pick<MyPostsData, 'matched_listings' | 'total_sent'>): [string, string] {
  return [`${data.matched_listings} phòng khớp`, `${data.total_sent} bài đã gửi`];
}

/** What to loosen when nothing matches, most useful first. */
export function wideningAdvice(q: MyPostsQuery): string[] {
  const advice: string[] = [];
  if (q.areas.length) advice.push(q.areas.length > 1 ? 'Bỏ bớt khu vực đã chọn.' : 'Chọn thêm một khu vực hoặc bỏ khu vực đang chọn.');
  if (q.priceMax != null) advice.push('Tăng mức giá đến.');
  if (q.priceMin != null) advice.push('Giảm mức giá từ.');
  if (q.areaMin != null) advice.push('Giảm diện tích tối thiểu.');
  if (q.types.length) advice.push('Bỏ bớt loại phòng đã chọn.');
  if (q.group !== 'all') advice.push('Chuyển sang nhóm Tất cả.');
  if (!q.includeNotRental) advice.push('Bật Hiện cả bài không phải cho thuê nếu bạn nghi bài bị phân loại nhầm.');
  return advice;
}

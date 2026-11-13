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

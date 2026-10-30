// Static invented teaching examples. Never used as fallback for an API response.
import { DETAILS, COMPARISONS } from '@/lib/api/mock-data';
import type { ListingDetail, Comparison } from '@/lib/api/types';
export { ev } from '@/lib/api/mock-data';

function illustration(id: string): { detail: ListingDetail; comparison: Comparison } {
  const p = DETAILS[id];
  const c = COMPARISONS[id];
  return {
    detail: {
      listing: {
        ...p.listing,
        rent: { ...p.listing.rent, evidence: p.listing.rent.evidence ?? [] },
        area: { ...p.listing.area, evidence: p.listing.area.evidence ?? [] },
        room: { ...p.listing.room, evidence: p.listing.room.evidence ?? [] },
        location: { ...p.listing.location, evidence: p.listing.location.evidence ?? [] },
      },
      post: { ...p.post, post_type: 'rental_offer' },
      sibling_count: p.sibling_count, cluster_id: null, price_history: [], is_demo: true,
    },
    comparison: { ...c, message: c.status === 'ok'
      ? 'Minh họa tự tạo: giá gần trung vị nhóm tin tương tự.'
      : 'Minh họa tự tạo: chưa đủ dữ liệu để nhận định.',
      disclaimer: 'Số liệu minh họa tự tạo, không phải thống kê kho.', is_demo: true },
  };
}
export const HERO_EXAMPLE = illustration('l-01');
export const FEW_EXAMPLE = illustration('l-10');

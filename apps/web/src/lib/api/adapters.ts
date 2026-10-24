import type { components } from './generated';
import type { ListingDetail, ListingsResponse } from './types';

/** UI shapes stay separate from generated DTOs. Preserve null and code point evidence. */
export function adaptDetail(dto: components['schemas']['ListingDetail']): ListingDetail { return dto; }
export function adaptListings(dto: components['schemas']['ListingsResponse']): ListingsResponse { return dto; }

import 'server-only';
import { cache } from 'react';
import { ApiError, createRenerApi } from './http';
import { adaptDetail, adaptListings } from './adapters';
import { collectCatalog } from './catalog';

export type ListingQuery = NonNullable<import('./generated').paths['/api/v1/listings']['get']['parameters']['query']>;
const api = () => createRenerApi(process.env.API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1',
  Number(process.env.API_TIMEOUT_MS) > 0 ? Number(process.env.API_TIMEOUT_MS) : 8000);

export async function getListings(query: ListingQuery = {}) { return adaptListings(await api().listings(query)); }
// Request-scoped deduplication for metadata/page. HTTP reads always use no-store.
export const getListing = cache(async (id: string, demo?: boolean) => {
  try { return adaptDetail(await api().listing(id, demo)); }
  catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
});
export const getComparison = (id: string, demo?: boolean) => api().comparison(id, demo);
export const getStatsOverview = (demo?: boolean) => api().overview(demo);
export const getCatalog = cache((demo?: boolean) => collectCatalog((page) => api().listings({ demo, page, page_size: 100 })));

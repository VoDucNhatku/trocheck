import 'server-only';
import createClient from 'openapi-fetch';
import type { paths } from '@/lib/api/generated';
import { ApiError } from '@/lib/api/http';

/** Public API, generated contract, no illustrative fallback or client statistics. */
export async function getHomeMarket(demo?: boolean) {
  const baseUrl = (process.env.API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1').replace(/\/api\/v1\/?$/, '');
  const client = createClient<paths>({ baseUrl });
  try {
    const { data, response } = await client.GET('/api/v1/market/summary', {
      params: { query: { basis: 'per_unit', demo } }, cache: 'no-store',
      signal: AbortSignal.timeout(Number(process.env.API_TIMEOUT_MS) || 8000),
    });
    if (!response.ok || !data) throw new ApiError(response.status, 'market_unavailable', 'Chưa tải được giá tham khảo. Hãy thử tải lại trang.');
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, 'market_unavailable', 'Không kết nối được API thị trường. Hãy thử tải lại trang.');
  }
}

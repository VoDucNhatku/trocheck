import createClient from 'openapi-fetch';
import type { paths, components } from './generated';

type ApiResult<T> = { data?: T; error?: unknown; response: Response };
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly requestId?: string) {
    super(message);
    this.name = 'ApiError';
  }
}
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không tải được dữ liệu. Vui lòng thử lại.';
}

/** Generated paths/DTOs drive this transport. No credentials or prototype fallback. */
export function createRenerApi(baseUrl: string, timeoutMs = 8000, fetcher: typeof fetch = fetch) {
  const client = createClient<paths>({ baseUrl: baseUrl.replace(/\/api\/v1\/?$/, ''), fetch: fetcher });
  async function request<T>(run: (signal: AbortSignal) => Promise<ApiResult<T>>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { data, error, response } = await run(controller.signal);
      if (!response.ok) {
        const body = error as Partial<components['schemas']['ErrorResponse']> | undefined;
        throw new ApiError(response.status, body?.error?.code ?? 'http_error',
          body?.error?.message ?? `API tạm không khả dụng (HTTP ${response.status}).`, body?.error?.request_id);
      }
      if (data === undefined) throw new ApiError(502, 'invalid_response', 'API trả dữ liệu không hợp lệ.');
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw new ApiError(504, 'timeout', 'API phản hồi quá lâu. Vui lòng thử lại.');
      if (error instanceof SyntaxError) throw new ApiError(502, 'invalid_response', 'API trả dữ liệu không hợp lệ.');
      throw new ApiError(503, 'network_error', 'Không kết nối được API. Vui lòng thử lại.');
    } finally { clearTimeout(timer); }
  }
  return {
    listings: (query: NonNullable<paths['/api/v1/listings']['get']['parameters']['query']> = {}) =>
      request((signal) => client.GET('/api/v1/listings', { params: { query }, cache: 'no-store', signal })),
    listing: (id: string, demo?: boolean) => request((signal) => client.GET('/api/v1/listings/{listing_id}', {
      params: { path: { listing_id: id }, query: { demo } }, cache: 'no-store', signal,
    })),
    comparison: (id: string, demo?: boolean) => request((signal) => client.GET('/api/v1/listings/{listing_id}/comparison', {
      params: { path: { listing_id: id }, query: { demo } }, cache: 'no-store', signal,
    })),
    overview: (demo?: boolean) => request((signal) => client.GET('/api/v1/stats/overview', {
      params: { query: { demo } }, cache: 'no-store', signal,
    })),
  };
}

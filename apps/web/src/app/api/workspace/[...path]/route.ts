import { NextRequest } from 'next/server';
import { apiBase, sessionCookieName } from '@/lib/workspace/server';
import { workspaceRouteAllowed } from '@/lib/workspace/safe-path';

export const dynamic = 'force-dynamic';
function failure(status: number, message: string) {
  return Response.json({ error: { code: 'workspace_request', message } }, { status, headers: { 'Cache-Control': 'no-store' } });
}
/** nextUrl.origin may be rewritten (dev reports localhost for 127.0.0.1); compare with the Host the browser used. */
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!origin || !host) return false;
  try { const url = new URL(origin); return url.host === host && (url.protocol === 'https:' || url.protocol === 'http:'); }
  catch { return false; }
}
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const path = (await context.params).path.join('/');
  if (!workspaceRouteAllowed(path, request.method)) return failure(404, 'Đường gọi không được hỗ trợ.');
  if (request.method !== 'GET') {
    if (!sameOrigin(request) || request.headers.get('x-rener-request') !== '1') {
      return failure(403, 'Nguồn yêu cầu không hợp lệ. Tải lại trang rồi thử lại.');
    }
    if (!request.headers.get('content-type')?.startsWith('application/json')) return failure(415, 'Cần gửi dữ liệu JSON.');
  }
  const body = request.method === 'GET' ? undefined : await request.text();
  if (body && new TextEncoder().encode(body).length > 180000) return failure(413, 'Nội dung quá dài.');
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const cookie = request.cookies.get(sessionCookieName);
  if (cookie) headers.set('Cookie', cookie.name + '=' + cookie.value);
  try {
    const upstream = await fetch(apiBase() + '/' + path + request.nextUrl.search, {
      method: request.method, headers, body, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(15000),
    });
    if (upstream.status >= 300 && upstream.status < 400) return failure(502, 'Máy chủ trả điều hướng không được hỗ trợ.');
    const resultHeaders = new Headers({ 'Cache-Control': 'private, no-store', Vary: 'Cookie' });
    for (const key of ['Content-Type', 'Content-Disposition', 'Retry-After']) {
      const value = upstream.headers.get(key); if (value) resultHeaders.set(key, value);
    }
    for (const value of upstream.headers.getSetCookie()) resultHeaders.append('Set-Cookie', value);
    return new Response(upstream.status === 204 ? null : await upstream.arrayBuffer(), { status: upstream.status, headers: resultHeaders });
  } catch { return failure(503, 'Không kết nối được máy chủ ReNER. Hãy thử lại sau.'); }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;

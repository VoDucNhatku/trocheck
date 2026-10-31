import { NextRequest, NextResponse } from 'next/server';
import { apiBase, sessionCookieName } from './server';
import { safeReturnPath } from './safe-path';

const oauthCookie = 'rener_google_oauth';
const cookiePath = '/api/auth/google';
const errors: Record<string, string> = {
  google_not_configured: 'Đăng nhập Google chưa được cấu hình. Bạn vẫn có thể dùng tên tài khoản và mật khẩu.',
  google_state_invalid: 'Yêu cầu đăng nhập đã hết hạn hoặc không hợp lệ. Hãy thử lại.',
  google_denied: 'Chưa hoàn tất đăng nhập Google. Hãy thử lại khi bạn sẵn sàng.',
  google_account_conflict: 'Email Google này đã có tài khoản TrọCheck. Hãy đăng nhập bằng tên tài khoản và mật khẩu đã tạo.',
  google_unavailable: 'Chưa kết nối được máy chủ đăng nhập. Hãy thử lại sau.',
};

export function googleErrorMessage(code: string | string[] | undefined): string {
  return typeof code === 'string' && Object.hasOwn(errors, code) ? errors[code] : '';
}

function redirect(path: string) {
  // Relative app redirects preserve the browser's host, even behind Next/Vercel proxies.
  const response = new NextResponse(null, { status: 303, headers: { Location: path } });
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

function failure(_request: NextRequest, code: string) {
  const response = redirect('/dang-nhap?oauth_error=' + (Object.hasOwn(errors, code) ? code : 'google_unavailable'));
  response.cookies.set(oauthCookie, '', { path: cookiePath, maxAge: 0, httpOnly: true, sameSite: 'lax' });
  return response;
}

async function errorCode(upstream: Response): Promise<string> {
  try { return (await upstream.json())?.error?.code ?? 'google_unavailable'; }
  catch { return 'google_unavailable'; }
}

export async function startGoogle(request: NextRequest) {
  const path = safeReturnPath(request.nextUrl.searchParams.get('next'));
  try {
    const upstream = await fetch(apiBase() + '/auth/google/start?next=' + encodeURIComponent(path.length <= 1000 ? path : '/phan-tich'), {
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(20000),
    });
    if (!upstream.ok) return failure(request, await errorCode(upstream));
    const data = await upstream.json();
    const url = new URL(data.authorization_url);
    if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth') return failure(request, 'google_unavailable');
    const response = redirect(url.href);
    const cookie = upstream.headers.getSetCookie().find(value => value.startsWith(oauthCookie + '='));
    if (!cookie) return failure(request, 'google_unavailable');
    response.headers.append('Set-Cookie', cookie);
    return response;
  } catch { return failure(request, 'google_unavailable'); }
}

export async function completeGoogle(request: NextRequest) {
  if (request.nextUrl.searchParams.has('error')) return failure(request, 'google_denied');
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookie = request.cookies.get(oauthCookie);
  if (!code || !state || !cookie || code.length > 4096 || state.length > 200) return failure(request, 'google_state_invalid');
  try {
    const upstream = await fetch(apiBase() + '/auth/google/callback', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie.name + '=' + cookie.value },
      body: JSON.stringify({ code, state }), cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(45000),
    });
    if (!upstream.ok) return failure(request, await errorCode(upstream));
    const data = await upstream.json();
    const session = upstream.headers.getSetCookie().find(value => value.startsWith(sessionCookieName + '='));
    if (!session) return failure(request, 'google_unavailable');
    const response = redirect(safeReturnPath(typeof data.next === 'string' ? data.next : null));
    response.cookies.set(oauthCookie, '', { path: cookiePath, maxAge: 0, httpOnly: true, sameSite: 'lax' });
    response.headers.append('Set-Cookie', session);
    return response;
  } catch { return failure(request, 'google_unavailable'); }
}

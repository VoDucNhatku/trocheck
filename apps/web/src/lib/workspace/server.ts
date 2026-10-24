import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Role, SessionUser } from './types';
import { hasRole } from './types';

export const sessionCookieName = process.env.RENER_SESSION_COOKIE ?? 'rener_session';
export const apiBase = () => (process.env.API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');
export const sessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookie = (await cookies()).get(sessionCookieName);
  if (!cookie) return null;
  const response = await fetch(apiBase() + '/auth/me', {
    headers: { Cookie: cookie.name + '=' + cookie.value }, cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Không xác minh được phiên đăng nhập. Hãy thử tải lại trang.');
  return response.json() as Promise<SessionUser>;
});
export async function requireUser(path: string, roles: Role[] = []) {
  const user = await sessionUser();
  if (!user) redirect('/dang-nhap?next=' + encodeURIComponent(path));
  return { user, allowed: roles.length === 0 || hasRole(user, ...roles) };
}

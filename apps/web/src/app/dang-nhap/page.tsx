import { redirect } from 'next/navigation';
import { AuthForm } from './AuthForm';
import { sessionUser } from '@/lib/workspace/server';
import { safeReturnPath } from '@/lib/workspace/safe-path';
export const metadata = { title: 'Đăng nhập', icons: { icon: '/brand/trocheck-icon.png' } };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeReturnPath(typeof query.next === 'string' ? query.next : null);
  if (await sessionUser()) redirect(next);
  return <AuthForm next={next} expired={query.expired === '1' || query.state === 'expired'} variant={query.v === 'b'} />;
}

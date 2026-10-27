import { redirect } from 'next/navigation';
import { Login } from '@/features/workspace/Login';
import { sessionUser } from '@/lib/workspace/server';
import { safeReturnPath } from '@/lib/workspace/safe-path';
export const metadata = { title: 'Đăng nhập' };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const next = safeReturnPath(typeof query.next === 'string' ? query.next : null);
  if (await sessionUser()) redirect(next);
  return <Login next={next} expired={query.expired === '1'} />;
}

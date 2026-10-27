import { Store } from './_components/Store';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/workspace/server';
import { filterQuery } from '@/lib/workspace/query';
export const metadata = { title: 'Kho dữ liệu' };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = filterQuery(await searchParams, ['status', 'group', 'collector', 'post_type', 'date_from', 'date_to', 'page']);
  const { user, allowed } = await requireUser('/team/kho?' + query, ['collector', 'reviewer']);
  if (!allowed) redirect('/team/403');
  return <Store user={user} query={query} />;
}

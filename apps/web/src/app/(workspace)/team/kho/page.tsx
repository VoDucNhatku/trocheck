import { Store } from '@/features/workspace/Team';
import { Forbidden } from '@/features/workspace/ui';
import { requireUser } from '@/lib/workspace/server';
import { filterQuery } from '@/lib/workspace/query';
export const metadata = { title: 'Kho dữ liệu' };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = filterQuery(await searchParams, ['status', 'group', 'collector', 'post_type', 'date_from', 'date_to', 'page']);
  const { user, allowed } = await requireUser('/team/kho?' + query, ['collector', 'reviewer']);
  return allowed ? <Store user={user} query={query} /> : <Forbidden />;
}

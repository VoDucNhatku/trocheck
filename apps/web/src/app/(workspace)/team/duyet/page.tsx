import { Queue } from '@/features/workspace/Team';
import { Forbidden } from '@/features/workspace/ui';
import { requireUser } from '@/lib/workspace/server';
import { filterQuery } from '@/lib/workspace/query';
export const metadata = { title: 'Hàng duyệt' };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = filterQuery(await searchParams, ['reason', 'page']);
  const { allowed } = await requireUser('/team/duyet?' + query, ['reviewer']);
  return allowed ? <Queue query={query} /> : <Forbidden />;
}

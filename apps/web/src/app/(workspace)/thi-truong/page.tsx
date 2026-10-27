import { Market } from '@/features/workspace/Market';
import { requireUser } from '@/lib/workspace/server';
export const metadata = { title: 'Thị trường' };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const key of ['ward', 'type', 'basis', 'demo']) {
    const value = query[key]; if (Array.isArray(value)) value.forEach(item => params.append(key, item)); else if (value) params.set(key, value);
  }
  await requireUser('/thi-truong?' + params.toString());
  const first = (key: string, fallback = '') => params.get(key) ?? fallback;
  return <Market query={params.toString()} filters={{ ward: first('ward'), type: first('type'), basis: first('basis', 'per_unit'), demo: first('demo', 'true') }} />;
}

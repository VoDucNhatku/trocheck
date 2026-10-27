import { Analyze } from '@/features/workspace/Analyze';
import { requireUser } from '@/lib/workspace/server';
export const metadata = { title: 'Phân tích bài đăng' };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const initialMode = query.source === 'image' ? 'image' : 'paste';
  const sampleCase = typeof query.case === 'string' ? query.case : '';
  const next = '/phan-tich' + (initialMode === 'image' ? '?source=image' + (sampleCase ? '&case=' + encodeURIComponent(sampleCase) : '') : '');
  await requireUser(next);
  return <Analyze initialMode={initialMode} sampleCase={sampleCase} />;
}

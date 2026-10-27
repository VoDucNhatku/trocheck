import { ReviewDetail } from '@/features/workspace/ReviewDetail';
import { Forbidden } from '@/features/workspace/ui';
import { requireUser } from '@/lib/workspace/server';

export const metadata = { title: 'Duyệt một tin' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await requireUser('/team/duyet/' + encodeURIComponent(id), ['reviewer']);
  return allowed ? <ReviewDetail id={id} /> : <Forbidden />;
}

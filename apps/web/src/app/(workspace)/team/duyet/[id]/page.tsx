import { ReviewDetail } from '../_components/ReviewDetail';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/workspace/server';

export const metadata = { title: 'Duyệt một tin' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await requireUser('/team/duyet/' + encodeURIComponent(id), ['reviewer']);
  if (!allowed) redirect('/team/403');
  return <ReviewDetail id={id} />;
}

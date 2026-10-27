import { Evaluation } from '@/features/workspace/Evaluation';
import { Forbidden } from '@/features/workspace/ui';
import { requireUser } from '@/lib/workspace/server';

export const metadata = { title: 'Đánh giá' };

export default async function Page() {
  const { allowed } = await requireUser('/team/danh-gia', ['researcher']);
  return allowed ? <Evaluation /> : <Forbidden />;
}

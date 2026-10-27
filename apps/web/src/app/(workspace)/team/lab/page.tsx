import { Lab } from '@/features/workspace/Lab';
import { Forbidden } from '@/features/workspace/ui';
import { requireUser } from '@/lib/workspace/server';

export const metadata = { title: 'Lab đối chiếu' };

export default async function Page() {
  const { allowed } = await requireUser('/team/lab', ['researcher']);
  return allowed ? <Lab /> : <Forbidden />;
}

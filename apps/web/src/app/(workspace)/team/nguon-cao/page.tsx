import { TeamDirectory } from '@/features/workspace/TeamAdmin';
import { Forbidden } from '@/features/workspace/ui';
import { requireUser } from '@/lib/workspace/server';

export const metadata = { title: 'Nguồn cào', icons: { icon: '/brand/trocheck-icon.png' } };
export default async function Page() {
  const { allowed } = await requireUser('/team/nguon-cao', ['admin', 'researcher']);
  return allowed ? <TeamDirectory kind="sources" /> : <Forbidden />;
}

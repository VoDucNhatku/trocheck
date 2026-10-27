import { TeamDirectory } from '@/features/workspace/TeamAdmin';
import { Forbidden } from '@/features/workspace/ui';
import { requireUser } from '@/lib/workspace/server';

export const metadata = { title: 'Người dùng', icons: { icon: '/brand/trocheck-icon.png' } };
export default async function Page() {
  const { user, allowed } = await requireUser('/team/nguoi-dung', ['admin', 'researcher']);
  return allowed ? <TeamDirectory kind="users" admin={user.roles.includes('admin')} /> : <Forbidden />;
}

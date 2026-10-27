import { Notifications } from '@/features/workspace/Notifications';
import { requireUser } from '@/lib/workspace/server';

export const metadata = { title: 'Thông báo', icons: { icon: '/brand/trocheck-icon.png' } };
export default async function Page() {
  const { user } = await requireUser('/thong-bao');
  return <Notifications user={user} />;
}

import { Lab } from './_components/Lab';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/workspace/server';

export const metadata = { title: 'Kiểm tra trích xuất' };

export default async function Page() {
  const { allowed } = await requireUser('/team/kiem-tra', ['researcher']);
  if (!allowed) redirect('/team/403');
  return <Lab />;
}

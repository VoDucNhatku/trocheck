import { Analysis } from '@/features/workspace/Reading';
import { requireUser } from '@/lib/workspace/server';
export const metadata = { title: 'Bản đọc tin' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; await requireUser('/phan-tich/' + encodeURIComponent(id)); return <Analysis id={id} />;
}

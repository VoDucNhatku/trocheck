import { MyPosts } from '@/features/workspace/MyPosts';
import { requireUser } from '@/lib/workspace/server';

export const metadata = { title: 'Bài của tôi' };
export default async function Page() {
  await requireUser('/bai-cua-toi');
  return <MyPosts />;
}

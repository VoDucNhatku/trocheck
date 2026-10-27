import { Analyze } from '@/features/workspace/Analyze';
import { requireUser } from '@/lib/workspace/server';
export const metadata = { title: 'Phân tích bài đăng' };
export default async function Page() { await requireUser('/phan-tich'); return <Analyze />; }

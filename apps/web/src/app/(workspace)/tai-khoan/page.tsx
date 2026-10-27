import { Account } from '@/features/workspace/Account';
import { requireUser } from '@/lib/workspace/server';
export const metadata = { title: 'Tài khoản' };
export default async function Page() { const { user } = await requireUser('/tai-khoan'); return <Account user={user} />; }

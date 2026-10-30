import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeReturnPath } from '@/lib/workspace/safe-path';
import { StatusScreen } from '../_status/StatusScreen';
import RenterLayout from '../(renter)/layout';

export const metadata: Metadata = { title: 'Không thể mở trang', robots: { index: false, follow: false } };

export default async function StatusPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  if (query.code === '403') redirect('/team/403');
  const kind = query.code === 'het-phien' ? 'expired' : query.code === '500' ? 'server-error' : 'not-found';
  const next = safeReturnPath(typeof query.next === 'string' ? query.next : null);
  return <RenterLayout><StatusScreen kind={kind} loginHref={'/dang-nhap?state=expired&next=' + encodeURIComponent(next)} /></RenterLayout>;
}

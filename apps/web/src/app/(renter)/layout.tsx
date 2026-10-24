import { SiteFooter } from '@/components/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';
import { sessionUser } from '@/lib/workspace/server';
import { Suspense } from 'react';

export default async function RenterLayout({ children }: { children: React.ReactNode }) {
  // Public pages must still render when the session check fails, so treat any error as signed out.
  const user = await sessionUser().catch(() => null);
  const account = user ? user.username : null;
  return (
    <>
      <Suspense><SiteHeader account={account} /></Suspense>
      <main id="main" tabIndex={-1}>{children}</main>
      <Suspense><SiteFooter account={account} /></Suspense>
    </>
  );
}

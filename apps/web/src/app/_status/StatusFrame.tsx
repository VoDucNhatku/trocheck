import { Suspense } from 'react';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter/SiteFooter';
import { StatusScreen, type StatusKind } from './StatusScreen';

// Error recovery must not depend on the API or session lookup that may have failed.
export function StatusFrame({ kind, onRetry }: { kind: StatusKind; onRetry?: () => void }) {
  return <>
    <Suspense><SiteHeader /></Suspense>
    <main id="main" tabIndex={-1}><StatusScreen kind={kind} onRetry={onRetry} /></main>
    <Suspense><SiteFooter /></Suspense>
  </>;
}

import { Market } from '@/features/workspace/Market';
import { sessionUser } from '@/lib/workspace/server';
import { getCatalog } from '@/lib/api/client';
import { marketFilters, marketQuery } from '@/features/workspace/Market.model';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter/SiteFooter';
import { Suspense } from 'react';
import styles from '@/features/workspace/Market.module.css';
export const metadata = { title: 'Thị trường' };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = marketFilters(await searchParams);
  const query = marketQuery(filters);
  const user = await sessionUser();
  const catalog = await getCatalog(filters.demo === 'true').catch(() => null);
  const content = <Market query={query} filters={filters} wards={catalog?.wards ?? []} showThemeToggle={!!user} />;
  return user ? content : <><Suspense><SiteHeader /></Suspense><main id="main" tabIndex={-1} className={`container ${styles.publicPage}`}>{content}</main><Suspense><SiteFooter /></Suspense></>;
}

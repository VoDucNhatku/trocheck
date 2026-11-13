import { Suspense } from 'react';
import { HomeMarket } from '@/features/landing/HomeMarket';
import { PrototypeLanding } from '@/features/landing/PrototypeLanding';
import { HomeStats } from '@/features/landing/HomeStats';
import { getHomeOverview } from '@/features/landing/market';

import { parseDemo, type SearchParams } from '@/features/listings/filters';

export const revalidate = 60;

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const demo = parseDemo(await searchParams);
  const overview = await getHomeOverview(demo);
  const selectedDemo = overview?.is_demo ?? demo;
  return <PrototypeLanding demo={selectedDemo} stats={<HomeStats data={overview} />} market={<Suspense fallback={null}><HomeMarket demo={selectedDemo} /></Suspense>} />;
}

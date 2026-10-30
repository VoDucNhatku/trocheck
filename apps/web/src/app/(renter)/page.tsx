import { PrototypeLanding } from '@/features/landing/PrototypeLanding';

import { parseDemo, type SearchParams } from '@/features/listings/filters';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const demo = parseDemo(await searchParams);
  return <PrototypeLanding demo={demo} />;
}

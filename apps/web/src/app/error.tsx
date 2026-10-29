'use client';

import { StatusFrame } from './_status/StatusFrame';
import { useRouter } from 'next/navigation';
import { startTransition } from 'react';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  return <StatusFrame kind="server-error" onRetry={() => startTransition(() => { router.refresh(); reset(); })} />;
}

'use client';
import { useSearchParams } from 'next/navigation';

/** Keep explicit demo/real selection through public navigation, including fragment links. */
export function useDatasetHref() {
  const value = useSearchParams().get('demo');
  return (href: string) => {
    if (value !== 'true' && value !== 'false') return href;
    const url = new URL(href, 'http://local');
    url.searchParams.set('demo', value);
    return `${url.pathname}${url.search}${url.hash}`;
  };
}

import { notFound } from 'next/navigation';
import { ComponentCatalog } from '@/components/ComponentCatalog/ComponentCatalog';

export default function ComponentsPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ComponentCatalog />;
}

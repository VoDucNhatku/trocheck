import { Shell } from '@/features/workspace/Shell';
import { sessionUser } from '@/lib/workspace/server';
export const dynamic = 'force-dynamic';
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await sessionUser();
  // Each page supplies its exact return path before rendering protected content.
  return user ? <Shell user={user}>{children}</Shell> : children;
}

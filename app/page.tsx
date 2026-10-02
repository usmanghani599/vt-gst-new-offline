/**
 * DESKTOP VERSION (desktop-owned): no marketing landing page on desktop.
 */
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth';

export default async function Home() {
  const auth = await getAuthContext();
  redirect(auth ? '/dashboard' : '/login');
}

import { getAuthContext } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { MediaManagerClient } from './media-client';

export const metadata = {
  title: 'Amazon S3 Media & Storage Manager - VTGST',
  description: 'Manage photos, recordings, payment slips and files hosted on Amazon S3',
};

export default async function MediaPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) {
    redirect('/auth/login');
  }

  return (
    <AppShell>
      <MediaManagerClient company={authContext.company} />
    </AppShell>
  );
}

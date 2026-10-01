import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { DesktopSettingsClient } from './settings-client';

export const dynamic = 'force-dynamic';

export default async function DesktopSettingsPage() {
  const auth = await getAuthContext();
  if (!auth) redirect('/login');
  const companies = await prisma.company.findMany({ select: { id: true, name: true, gstin: true } });
  return (
    <AppShell>
      <DesktopSettingsClient
        isOwner={auth.company?.role === 'OWNER'}
        activeCompany={auth.company ? { id: auth.company.id, name: auth.company.name } : null}
        companies={companies}
      />
    </AppShell>
  );
}

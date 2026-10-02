import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { TenantOrdersClient } from './orders-client';

export default async function TenantOrdersPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  return (
    <AppShell>
      <TenantOrdersClient companyId={authContext.company.id} />
    </AppShell>
  );
}

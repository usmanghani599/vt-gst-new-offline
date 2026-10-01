import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { OrderSplitScreenProcessClient } from './process-client';

export default async function OrderSplitScreenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const resolvedParams = await params;

  return (
    <AppShell>
      <OrderSplitScreenProcessClient orderId={resolvedParams.id} />
    </AppShell>
  );
}

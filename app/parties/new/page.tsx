import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { PartyForm } from './party-form';

interface NewPartyPageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function NewPartyPage({ searchParams }: NewPartyPageProps) {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;
  const resolvedSearchParams = await searchParams;
  const defaultType = resolvedSearchParams?.type || 'CUSTOMER';

  const [partyGroups, states] = await Promise.all([
    prisma.partyGroup.findMany({ where: { companyId }, orderBy: { name: 'asc' } }),
    prisma.state.findMany({ where: { country: { code: 'IN' } }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Add New {defaultType === 'SUPPLIER' ? 'Supplier / Vendor' : 'Customer'}
          </h1>
          <p className="text-xs text-slate-500">
            Set up legal details, GST registration type, address, credit limit, and opening balance
          </p>
        </div>

        <PartyForm partyGroups={partyGroups} states={states} defaultType={defaultType} />
      </div>
    </AppShell>
  );
}

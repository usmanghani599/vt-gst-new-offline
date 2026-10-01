import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { LedgerService } from '@/lib/services/ledger-service';
import { PartyLedgerClient } from './ledger-client';

interface PartyLedgerPageProps {
  searchParams: Promise<{ partyId?: string; fromDate?: string; toDate?: string }>;
}

export default async function PartyLedgerPage({ searchParams }: PartyLedgerPageProps) {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;
  const resolvedSearchParams = await searchParams;

  const [parties, bankAccounts] = await Promise.all([
    prisma.party.findMany({
      where: { companyId, isWalkIn: false },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
    }),
  ]);

  const selectedPartyId = resolvedSearchParams?.partyId || parties[0]?.id || '';
  const fromDate = resolvedSearchParams?.fromDate;
  const toDate = resolvedSearchParams?.toDate;

  let ledgerData: any = null;
  if (selectedPartyId) {
    ledgerData = await LedgerService.getPartyLedger({
      companyId,
      partyId: selectedPartyId,
      fromDate,
      toDate,
    });
  }

  return (
    <AppShell>
      <PartyLedgerClient
        parties={parties}
        bankAccounts={bankAccounts}
        selectedPartyId={selectedPartyId}
        ledgerData={ledgerData}
        fromDate={fromDate}
        toDate={toDate}
      />
    </AppShell>
  );
}

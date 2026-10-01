import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { InvoiceForm } from '@/app/sales/invoices/new/invoice-form';

export default async function NewPurchasePage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;

  const [parties, items, salesmen, states, bankAccounts] = await Promise.all([
    prisma.party.findMany({
      where: {
        companyId,
        isActive: true,
        partyType: { in: ['SUPPLIER', 'BOTH'] },
      },
      include: { state: true },
      orderBy: { name: 'asc' },
    }),
    prisma.item.findMany({
      where: { companyId, isActive: true },
      include: { taxRate: true, unit: true },
      orderBy: { name: 'asc' },
    }),
    prisma.salesman.findMany({
      where: { companyId, isActive: true },
    }),
    prisma.state.findMany({
      where: { country: { code: 'IN' } },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
    }),
  ]);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Record Purchase Invoice</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log supplier bills with automatic stock additions and Input Tax Credit ledger entries
          </p>
        </div>

        <InvoiceForm
          company={authContext.company}
          parties={parties}
          items={items}
          salesmen={salesmen}
          states={states}
          bankAccounts={bankAccounts}
          documentType="PURCHASE"
        />
      </div>
    </AppShell>
  );
}

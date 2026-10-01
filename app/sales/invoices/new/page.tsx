import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { InvoiceForm } from './invoice-form';

export default async function NewInvoicePage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;

  const [parties, items, salesmen, states, bankAccounts] = await Promise.all([
    prisma.party.findMany({
      where: { companyId, isActive: true },
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
      orderBy: { name: 'asc' },
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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create Tax Invoice</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Issue a new GST-compliant sales invoice with automatic tax calculations
          </p>
        </div>

        <InvoiceForm
          company={authContext.company}
          parties={parties}
          items={items}
          salesmen={salesmen}
          states={states}
          bankAccounts={bankAccounts}
          documentType="SALE"
        />
      </div>
    </AppShell>
  );
}

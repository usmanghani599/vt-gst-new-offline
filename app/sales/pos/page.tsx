import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { PosInterface } from './pos-interface';

export default async function PosPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;

  const [rawItems, rawParties, categories, bankAccounts, salesmen] = await Promise.all([
    prisma.item.findMany({
      where: { companyId, isActive: true },
      include: { taxRate: true, unit: true, category: true },
      orderBy: { name: 'asc' },
    }),
    prisma.party.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.itemCategory.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
    }),
    prisma.salesman.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const items = rawItems.map((it) => ({
    id: it.id,
    name: it.name,
    sku: it.sku,
    barcode: it.barcode,
    categoryId: it.categoryId,
    salesPrice: Number(it.salesPrice),
    purchasePrice: Number(it.purchasePrice),
    unit: it.unit ? { code: it.unit.code, name: it.unit.name } : null,
    taxRate: it.taxRate ? { id: it.taxRate.id, rate: Number(it.taxRate.rate) } : null,
  }));

  const parties = rawParties.map((p) => ({
    id: p.id,
    name: p.name,
    mobile: p.mobile,
    phone: p.phone,
    gstin: p.gstin,
  }));

  const serializedSalesmen = salesmen.map((sm) => ({
    id: sm.id,
    name: sm.name,
    employeeCode: sm.employeeCode,
    pointsPerAmount: Number(sm.pointsPerAmount),
    commissionRate: Number(sm.commissionRate),
    userId: sm.userId,
  }));

  const loggedSalesman = serializedSalesmen.find((sm) => sm.userId === authContext.user.id);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Retail POS Counter</h1>
            <p className="text-xs text-slate-500">
              High-speed retail billing • Barcode scanner & keyboard shortcuts enabled
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/reports/cash-counter"
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-semibold text-xs rounded-lg transition inline-flex items-center gap-1.5 shadow-sm"
            >
              💵 Cash Handover / Collection
            </a>
            <a
              href="/sales/pos/receipts"
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition inline-flex items-center gap-1.5"
            >
              📜 Past POS Bills
            </a>
          </div>
        </div>

        <PosInterface
          company={authContext.company}
          items={items}
          parties={parties}
          categories={categories}
          bankAccounts={bankAccounts}
          salesmen={serializedSalesmen}
          loggedSalesmanId={loggedSalesman?.id}
        />
      </div>
    </AppShell>
  );
}

import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { AdjustmentForm } from './adjustment-form';

export default async function StockAdjustmentsPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const items = await prisma.item.findMany({
    where: { companyId: authContext.company.id, isService: false },
    include: { unit: true },
    orderBy: { name: 'asc' },
  });

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stock Adjustment</h1>
          <p className="text-xs text-slate-500">
            Record physical inventory corrections, damages, write-offs, or found stock
          </p>
        </div>

        <AdjustmentForm items={items} />
      </div>
    </AppShell>
  );
}

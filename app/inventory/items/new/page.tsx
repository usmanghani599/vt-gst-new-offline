import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { ItemCreateForm } from './item-create-form';

export default async function NewItemPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;

  const [rawCategories, rawUnits, rawTaxRates] = await Promise.all([
    prisma.itemCategory.findMany({ where: { companyId }, orderBy: { name: 'asc' } }),
    prisma.unit.findMany({ where: { OR: [{ companyId }, { isSystem: true }] }, orderBy: { name: 'asc' } }),
    prisma.taxRate.findMany({ where: { isActive: true }, orderBy: { rate: 'asc' } }),
  ]);

  const categories = rawCategories.map((c) => ({ id: c.id, name: c.name }));
  const units = rawUnits.map((u) => ({ id: u.id, name: u.name, code: u.code, uqcCode: u.uqcCode }));
  const taxRates = rawTaxRates.map((t) => ({ id: t.id, name: t.name, rate: Number(t.rate) }));

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Add New Catalog Item</h1>
          <p className="text-xs text-slate-500">
            Define product pricing, HSN/SAC code, GST rate, and opening inventory
          </p>
        </div>

        <ItemCreateForm categories={categories} units={units} taxRates={taxRates} />
      </div>
    </AppShell>
  );
}

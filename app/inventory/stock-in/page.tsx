import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { StockInClient } from './stock-in-client';
import { redirect } from 'next/navigation';

export default async function StockInPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) {
    redirect('/dashboard');
  }

  const companyId = authContext.company.id;

  const items = await prisma.item.findMany({
    where: { companyId, isService: false },
    include: {
      unit: true,
      category: true,
      stockMovements: true,
    },
    orderBy: { name: 'asc' },
  });

  const serializedItems = items.map((it) => {
    let currentStock = Number(it.openingStock);
    for (const m of it.stockMovements) {
      const q = Number(m.quantity);
      if (
        m.movementType === 'PURCHASE_IN' ||
        m.movementType === 'SALE_RETURN_IN' ||
        m.movementType === 'ADJUSTMENT_IN'
      ) {
        currentStock += q;
      } else {
        currentStock -= q;
      }
    }

    return {
      id: it.id,
      name: it.name,
      sku: it.sku,
      barcode: it.barcode,
      categoryName: it.category?.name || 'General',
      unitName: it.unit?.code || 'PCS',
      purchasePrice: Number(it.purchasePrice),
      salesPrice: Number(it.salesPrice),
      currentStock,
    };
  });

  return (
    <AppShell>
      <StockInClient items={serializedItems} companyName={authContext.company.name} />
    </AppShell>
  );
}

import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { StockService } from '@/lib/services/stock-service';
import prisma from '@/lib/db';
import { StockReportClient } from './stock-report-client';
import { redirect } from 'next/navigation';

export default async function StockReportPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) {
    redirect('/dashboard');
  }

  const companyId = authContext.company.id;

  const [stockSummary, categories] = await Promise.all([
    StockService.getStockSummary(companyId),
    prisma.itemCategory.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <AppShell>
      <StockReportClient
        stockItems={stockSummary}
        categories={categories}
        companyName={authContext.company.name}
      />
    </AppShell>
  );
}

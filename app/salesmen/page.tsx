import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import Decimal from 'decimal.js';
import { SalesmenClient } from './salesmen-client';

export default async function SalesmenPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;
  const userRole = authContext.company.role;
  const userId = authContext.user.id;
  const userEmail = authContext.user.email;

  const where: any = { companyId };
  if (userRole === 'SALESMAN') {
    where.OR = [
      { userId },
      { email: userEmail },
    ];
  }

  const salesmen = await prisma.salesman.findMany({
    where,
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
      },
      documents: {
        select: { id: true, grandTotal: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const serialized = salesmen.map((sm) => {
    let totalPoints = new Decimal(0);
    for (const t of sm.transactions) {
      if (t.type === 'CREDIT') totalPoints = totalPoints.plus(new Decimal(t.points));
      else totalPoints = totalPoints.minus(new Decimal(t.points));
    }

    let totalSales = new Decimal(0);
    for (const d of sm.documents) {
      totalSales = totalSales.plus(new Decimal(d.grandTotal));
    }

    return {
      id: sm.id,
      name: sm.name,
      employeeCode: sm.employeeCode,
      mobile: sm.mobile,
      email: sm.email,
      address: sm.address,
      commissionRate: Number(sm.commissionRate),
      pointsPerAmount: Number(sm.pointsPerAmount),
      isActive: sm.isActive,
      totalSales: totalSales.toNumber(),
      totalInvoices: sm.documents.length,
      currentPoints: totalPoints.toNumber(),
      transactions: sm.transactions.map((t) => ({
        id: t.id,
        type: t.type as 'CREDIT' | 'DEBIT',
        points: Number(t.points),
        amount: Number(t.amount),
        notes: t.notes,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  });

  const canManageSalesmen = userRole !== 'SALESMAN' && userRole !== 'POS_OPERATOR' && userRole !== 'READ_ONLY';

  return (
    <AppShell>
      <SalesmenClient initialSalesmen={serialized} canManageSalesmen={canManageSalesmen} />
    </AppShell>
  );
}

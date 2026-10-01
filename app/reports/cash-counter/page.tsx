import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import Decimal from 'decimal.js';
import { CashCounterClient } from './cash-counter-client';

interface CashCounterPageProps {
  searchParams: Promise<{
    date?: string;
    fromDate?: string;
    toDate?: string;
  }>;
}

export default async function CashCounterPage({ searchParams }: CashCounterPageProps) {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;
  const resolvedSearchParams = await searchParams;
  const fromDate = resolvedSearchParams?.fromDate;
  const toDate = resolvedSearchParams?.toDate;
  const date = resolvedSearchParams?.date;

  const todayStr = new Date().toISOString().split('T')[0];

  const whereDoc: any = {
    companyId,
    documentType: { in: ['POS', 'SALE', 'BILL_OF_SUPPLY'] },
  };

  const wherePay: any = {
    companyId,
    paymentType: 'IN_RECEIPT',
  };

  if (fromDate || toDate) {
    whereDoc.documentDate = {};
    wherePay.paymentDate = {};
    if (fromDate) {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      whereDoc.documentDate.gte = start;
      wherePay.paymentDate.gte = start;
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      whereDoc.documentDate.lte = end;
      wherePay.paymentDate.lte = end;
    }
  } else if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    whereDoc.documentDate = { gte: start, lte: end };
    wherePay.paymentDate = { gte: start, lte: end };
  } else {
    // Default: If transactions exist in the company, show current month / recent
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    whereDoc.documentDate = { gte: startOfMonth };
    wherePay.paymentDate = { gte: startOfMonth };
  }

  const [documents, payments, salesmen] = await Promise.all([
    prisma.document.findMany({
      where: whereDoc,
      include: {
        salesman: true,
        party: true,
        paymentAllocations: {
          include: { payment: true },
        },
      },
      orderBy: { documentDate: 'desc' },
    }),
    prisma.payment.findMany({
      where: wherePay,
      include: {
        party: true,
        allocations: {
          include: {
            document: {
              include: { salesman: true },
            },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    }),
    prisma.salesman.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Group collections by Salesman / Cashier / Counter
  const collectionsMap: Record<
    string,
    {
      id: string;
      name: string;
      code: string;
      isDirectCounter: boolean;
      totalCash: Decimal;
      totalUpi: Decimal;
      totalCard: Decimal;
      totalOther: Decimal;
      totalCollected: Decimal;
      billCount: number;
      transactions: Array<{
        id: string;
        docNumber: string;
        docType: string;
        date: string;
        customerName: string;
        paymentMode: string;
        amount: number;
      }>;
    }
  > = {};

  // Pre-populate with all active salesmen so even 0-collection staff appear
  for (const sm of salesmen) {
    collectionsMap[sm.id] = {
      id: sm.id,
      name: sm.name,
      code: sm.employeeCode || 'SM-01',
      isDirectCounter: false,
      totalCash: new Decimal(0),
      totalUpi: new Decimal(0),
      totalCard: new Decimal(0),
      totalOther: new Decimal(0),
      totalCollected: new Decimal(0),
      billCount: 0,
      transactions: [],
    };
  }

  // Direct Counter bucket
  const directCounterKey = 'direct_counter';
  collectionsMap[directCounterKey] = {
    id: directCounterKey,
    name: 'Direct Store Counter (Unassigned)',
    code: 'COUNTER-01',
    isDirectCounter: true,
    totalCash: new Decimal(0),
    totalUpi: new Decimal(0),
    totalCard: new Decimal(0),
    totalOther: new Decimal(0),
    totalCollected: new Decimal(0),
    billCount: 0,
    transactions: [],
  };

  // Process Documents
  for (const doc of documents) {
    const key = doc.salesmanId && collectionsMap[doc.salesmanId] ? doc.salesmanId : directCounterKey;
    const bucket = collectionsMap[key];

    const grandTotal = new Decimal(doc.grandTotal);
    bucket.billCount += 1;
    bucket.totalCollected = bucket.totalCollected.plus(grandTotal);

    // Determine payment mode from payment allocations or default to CASH for POS
    let pMode = 'CASH';
    if (doc.paymentAllocations.length > 0) {
      pMode = doc.paymentAllocations[0].payment.paymentMode;
    }

    if (pMode === 'CASH') {
      bucket.totalCash = bucket.totalCash.plus(grandTotal);
    } else if (pMode === 'UPI') {
      bucket.totalUpi = bucket.totalUpi.plus(grandTotal);
    } else if (pMode === 'CARD') {
      bucket.totalCard = bucket.totalCard.plus(grandTotal);
    } else {
      bucket.totalOther = bucket.totalOther.plus(grandTotal);
    }

    bucket.transactions.push({
      id: doc.id,
      docNumber: doc.documentNumber,
      docType: doc.documentType,
      date: doc.documentDate.toISOString(),
      customerName: doc.billingPartyName || doc.party?.name || 'Walk-in Customer',
      paymentMode: pMode,
      amount: grandTotal.toNumber(),
    });
  }

  // Filter out empty direct counter if unused
  const resultList = Object.values(collectionsMap)
    .filter((c) => !c.isDirectCounter || c.billCount > 0 || c.transactions.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      isDirectCounter: c.isDirectCounter,
      totalCash: c.totalCash.toNumber(),
      totalUpi: c.totalUpi.toNumber(),
      totalCard: c.totalCard.toNumber(),
      totalOther: c.totalOther.toNumber(),
      totalCollected: c.totalCollected.toNumber(),
      billCount: c.billCount,
      transactions: c.transactions,
    }));

  return (
    <AppShell>
      <CashCounterClient
        collections={resultList}
        selectedDate={date || todayStr}
        fromDate={fromDate}
        toDate={toDate}
      />
    </AppShell>
  );
}

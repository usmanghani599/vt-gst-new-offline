import React from 'react';
import { getAuthContext } from '@/lib/auth';
import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import { InvoicePrintTemplate } from '@/components/invoice-print-template';

interface InvoiceViewProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceViewPage({ params }: InvoiceViewProps) {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const { id } = await params;

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      party: true,
      items: true,
      taxes: true,
      transport: true,
      billingState: true,
      shippingState: true,
    },
  });

  if (!doc || doc.companyId !== authContext.company.id) {
    notFound();
  }

  const company = await prisma.company.findUnique({
    where: { id: authContext.company.id },
    include: { state: true },
  });

  const bankAccount = await prisma.bankAccount.findFirst({
    where: { companyId: authContext.company.id, isDefault: true },
  });

  return (
    <InvoicePrintTemplate
      document={doc}
      company={company}
      bankAccount={bankAccount}
      backHref="/sales/invoices"
    />
  );
}

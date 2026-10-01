import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import prisma from '@/lib/db';
import Decimal from 'decimal.js';
import { deviceNumberTag } from '@/lib/desktop-local/runtime';
import { PaymentType, PaymentMode } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company || !authContext.financialYear) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authContext.financialYear.isClosed) {
      return NextResponse.json({ error: 'Cannot record payments in a closed Financial Year' }, { status: 400 });
    }

    const body = await request.json();
    const {
      paymentType,
      partyId,
      amount,
      paymentDate,
      paymentMode,
      bankAccountId,
      referenceNumber,
      chequeNumber,
      notes,
      attachmentUrl,
    } = body;

    if (!partyId || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Valid party and positive amount are required' }, { status: 400 });
    }

    const companyId = authContext.company.id;
    const fyId = authContext.financialYear.id;
    const fy = authContext.financialYear;
    const amountDec = new Decimal(amount);
    const pDate = new Date(paymentDate || new Date());

    const result = await prisma.$transaction(async (tx) => {
      const prefix = paymentType === 'IN_RECEIPT' ? 'RCP' : 'PAY';
      const randNum = String(Math.floor(10000 + Math.random() * 90000));
      const paymentNumber = `${prefix}/${fy.name}/${deviceNumberTag()}${randNum}`;

      const payment = await tx.payment.create({
        data: {
          companyId,
          financialYearId: fyId,
          paymentType: (paymentType as PaymentType) || PaymentType.IN_RECEIPT,
          paymentNumber,
          paymentDate: pDate,
          partyId,
          amount: amountDec.toNumber(),
          paymentMode: (paymentMode as PaymentMode) || PaymentMode.CASH,
          bankAccountId: bankAccountId || null,
          referenceNumber: referenceNumber || null,
          chequeNumber: chequeNumber || null,
          notes: notes || null,
          attachmentUrl: attachmentUrl || null,
          createdByUserId: authContext.user.id,
        },
      });

      // Create Ledger Entry
      if (paymentType === 'IN_RECEIPT') {
        // Customer payment: Bank/Cash Dr, Customer Cr (Reduces customer balance)
        await tx.ledgerEntry.create({
          data: {
            companyId,
            financialYearId: fyId,
            partyId,
            paymentId: payment.id,
            entryDate: pDate,
            accountHead: 'BANK_OR_CASH',
            debit: 0,
            credit: amountDec.toNumber(),
            narration: notes || `Receipt #${paymentNumber}`,
          },
        });
      } else {
        // Supplier payment: Supplier Dr, Bank/Cash Cr (Reduces supplier payable)
        await tx.ledgerEntry.create({
          data: {
            companyId,
            financialYearId: fyId,
            partyId,
            paymentId: payment.id,
            entryDate: pDate,
            accountHead: 'ACCOUNTS_PAYABLE',
            debit: amountDec.toNumber(),
            credit: 0,
            narration: notes || `Payment #${paymentNumber}`,
          },
        });
      }

      return payment;
    });

    return NextResponse.json({ success: true, payment: result });
  } catch (error: any) {
    console.error('Payment error:', error);
    return NextResponse.json({ error: error.message || 'Payment processing failed' }, { status: 500 });
  }
}

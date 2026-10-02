import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import prisma from '@/lib/db';
import Decimal from 'decimal.js';
import { PointTransactionType } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { salesmanId, type, points, notes } = body;

    if (!salesmanId || !points || Number(points) <= 0) {
      return NextResponse.json({ error: 'Valid Salesman ID and positive point value are required' }, { status: 400 });
    }

    const companyId = authContext.company.id;

    const salesman = await prisma.salesman.findUnique({
      where: { id: salesmanId },
      include: { transactions: true },
    });

    if (!salesman || salesman.companyId !== companyId) {
      return NextResponse.json({ error: 'Salesman not found' }, { status: 404 });
    }

    const pointType = type === 'DEBIT' ? PointTransactionType.DEBIT : PointTransactionType.CREDIT;
    const pointDec = new Decimal(points);

    if (pointType === PointTransactionType.DEBIT) {
      let currentBalance = new Decimal(0);
      for (const t of salesman.transactions) {
        if (t.type === 'CREDIT') currentBalance = currentBalance.plus(new Decimal(t.points));
        else currentBalance = currentBalance.minus(new Decimal(t.points));
      }

      if (pointDec.greaterThan(currentBalance)) {
        return NextResponse.json(
          { error: `Cannot redeem ${pointDec} points. Current available balance is only ${currentBalance} points.` },
          { status: 400 }
        );
      }
    }

    const transaction = await prisma.salesmanPointTransaction.create({
      data: {
        salesmanId: salesman.id,
        type: pointType,
        points: pointDec.toNumber(),
        notes: notes?.trim() || (pointType === PointTransactionType.DEBIT ? 'Manual Point Redemption / Payout' : 'Manual Bonus Points'),
      },
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to process points transaction' }, { status: 500 });
  }
}

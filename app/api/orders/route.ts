import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthContext } from '@/lib/auth';
import { OrderStatus, OrderType } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = auth.company.id;
    const status = req.nextUrl.searchParams.get('status') as OrderStatus | null;
    const orderType = req.nextUrl.searchParams.get('orderType') as OrderType | null;
    const search = req.nextUrl.searchParams.get('search')?.trim() || '';

    // Metric counts
    const [placedCount, pendingCount, inProcessCount, completedCount, cancelledCount, allCount] = await Promise.all([
      prisma.clientOrder.count({ where: { companyId, status: OrderStatus.PLACED } }),
      prisma.clientOrder.count({ where: { companyId, status: OrderStatus.PENDING } }),
      prisma.clientOrder.count({ where: { companyId, status: OrderStatus.IN_PROCESS } }),
      prisma.clientOrder.count({ where: { companyId, status: OrderStatus.COMPLETED } }),
      prisma.clientOrder.count({ where: { companyId, status: OrderStatus.CANCELLED } }),
      prisma.clientOrder.count({ where: { companyId } }),
    ]);

    const metrics = {
      all: allCount,
      placed: placedCount,
      pending: pendingCount,
      inProcess: inProcessCount,
      completed: completedCount,
      cancelled: cancelledCount,
    };

    const orders = await prisma.clientOrder.findMany({
      where: {
        companyId,
        ...(status ? { status } : {}),
        ...(orderType ? { orderType } : {}),
        ...(search
          ? {
              OR: [
                { orderNumber: { contains: search } },
                { party: { name: { contains: search } } },
                { clientUser: { mobile: { contains: search } } },
              ],
            }
          : {}),
      },
      include: {
        party: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
            gstin: true,
            city: true,
          },
        },
        clientUser: {
          select: {
            id: true,
            name: true,
            mobile: true,
          },
        },
        items: {
          include: {
            item: true,
          },
        },
        attachments: true,
        document: {
          select: {
            id: true,
            documentNumber: true,
            grandTotal: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      metrics,
      orders,
    });
  } catch (error: any) {
    console.error('Fetch tenant orders error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch orders' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthContext } from '@/lib/auth';
import { OrderStatus } from '@prisma/client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { status } = await req.json();

    if (!status || !Object.values(OrderStatus).includes(status)) {
      return NextResponse.json({ error: 'Valid status is required' }, { status: 400 });
    }

    const order = await prisma.clientOrder.update({
      where: {
        id: resolvedParams.id,
        companyId: auth.company.id,
      },
      data: {
        status: status as OrderStatus,
      },
    });

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('Update order status error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update order status' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const item = await prisma.item.findFirst({
      where: {
        id: resolvedParams.id,
        companyId: auth.company.id,
      },
      include: {
        unit: true,
        category: true,
        taxRate: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch item' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const companyId = auth.company.id;

    const item = await prisma.item.findFirst({
      where: {
        id: resolvedParams.id,
        companyId,
      },
      include: {
        documentItems: { select: { id: true } },
        stockMovements: { select: { id: true } },
        clientOrderItems: { select: { id: true } },
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const docCount = item.documentItems.length;
    const movementCount = item.stockMovements.length;

    // If item is referenced in past invoices / stock records, deactivate it cleanly
    if (docCount > 0 || movementCount > 0) {
      await prisma.item.update({
        where: { id: item.id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: `Item "${item.name}" was deactivated and removed from active catalog (historical documents preserved).`,
      });
    }

    // Otherwise, clean delete
    await prisma.item.delete({
      where: { id: item.id },
    });

    return NextResponse.json({
      success: true,
      message: `Item "${item.name}" deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Delete item error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete item' },
      { status: 500 }
    );
  }
}

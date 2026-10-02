import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import prisma from '@/lib/db';
import Decimal from 'decimal.js';

export async function GET() {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = authContext.company.id;

    const salesmen = await prisma.salesman.findMany({
      where: { companyId },
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
          type: t.type,
          points: Number(t.points),
          amount: Number(t.amount),
          notes: t.notes,
          createdAt: t.createdAt.toISOString(),
        })),
      };
    });

    return NextResponse.json({ salesmen: serialized });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch salesmen' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, employeeCode, mobile, email, address, commissionRate, pointsPerAmount } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Salesman name is required' }, { status: 400 });
    }

    const companyId = authContext.company.id;
    const cleanCode = employeeCode?.trim() || null;

    if (cleanCode) {
      const existing = await prisma.salesman.findFirst({
        where: { companyId, employeeCode: cleanCode },
      });
      if (existing) {
        return NextResponse.json({ error: `A salesman with code '${cleanCode}' already exists.` }, { status: 400 });
      }
    }

    const salesman = await prisma.salesman.create({
      data: {
        companyId,
        name: name.trim(),
        employeeCode: cleanCode,
        mobile: mobile?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        commissionRate: new Decimal(commissionRate || 0).toNumber(),
        pointsPerAmount: new Decimal(pointsPerAmount || 1.0).toNumber(),
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, salesman });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create salesman' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, employeeCode, mobile, email, address, commissionRate, pointsPerAmount, isActive } = body;

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ error: 'Salesman ID and name are required' }, { status: 400 });
    }

    const companyId = authContext.company.id;

    const existing = await prisma.salesman.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json({ error: 'Salesman not found' }, { status: 404 });
    }

    const updated = await prisma.salesman.update({
      where: { id },
      data: {
        name: name.trim(),
        employeeCode: employeeCode?.trim() || null,
        mobile: mobile?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        commissionRate: new Decimal(commissionRate || 0).toNumber(),
        pointsPerAmount: new Decimal(pointsPerAmount || 0).toNumber(),
        isActive: typeof isActive === 'boolean' ? isActive : existing.isActive,
      },
    });

    return NextResponse.json({ success: true, salesman: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update salesman' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Salesman ID is required' }, { status: 400 });
    }

    const companyId = authContext.company.id;

    const existing = await prisma.salesman.findUnique({
      where: { id },
      include: {
        _count: { select: { documents: true } },
      },
    });

    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json({ error: 'Salesman not found' }, { status: 404 });
    }

    if (existing._count.documents > 0) {
      // Soft-delete by setting isActive to false
      await prisma.salesman.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, message: 'Salesman deactivated (has linked invoices)' });
    }

    await prisma.salesman.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Salesman deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete salesman' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = authContext.company.id;

    const units = await prisma.unit.findMany({
      where: {
        OR: [{ companyId }, { isSystem: true }],
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
    });

    return NextResponse.json({ units });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch units' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code, name, uqcCode } = body;

    if (!code || !name || !code.trim() || !name.trim()) {
      return NextResponse.json({ error: 'Unit symbol code and full name are required' }, { status: 400 });
    }

    const companyId = authContext.company.id;
    const cleanCode = code.trim().toUpperCase();

    // Check duplicate
    const existing = await prisma.unit.findFirst({
      where: {
        code: cleanCode,
        OR: [{ companyId }, { isSystem: true }],
      },
    });

    if (existing) {
      return NextResponse.json({ error: `A unit with code '${cleanCode}' already exists.` }, { status: 400 });
    }

    const unit = await prisma.unit.create({
      data: {
        companyId,
        code: cleanCode,
        name: name.trim(),
        uqcCode: uqcCode?.trim().toUpperCase() || cleanCode,
        isSystem: false,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, unit });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create unit' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, uqcCode, isActive } = body;

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ error: 'Unit ID and name are required' }, { status: 400 });
    }

    const companyId = authContext.company.id;

    const unit = await prisma.unit.findUnique({
      where: { id },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    if (unit.isSystem && unit.companyId !== companyId) {
      // For system units, can only toggle or update name if allowed
      const updated = await prisma.unit.update({
        where: { id },
        data: {
          isActive: typeof isActive === 'boolean' ? isActive : unit.isActive,
        },
      });
      return NextResponse.json({ success: true, unit: updated });
    }

    const updated = await prisma.unit.update({
      where: { id },
      data: {
        name: name.trim(),
        uqcCode: uqcCode?.trim().toUpperCase() || unit.uqcCode,
        isActive: typeof isActive === 'boolean' ? isActive : unit.isActive,
      },
    });

    return NextResponse.json({ success: true, unit: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update unit' }, { status: 500 });
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
      return NextResponse.json({ error: 'Unit ID is required' }, { status: 400 });
    }

    const companyId = authContext.company.id;

    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    if (unit.isSystem) {
      return NextResponse.json({ error: 'System standard GST units cannot be deleted.' }, { status: 400 });
    }

    if (unit.companyId !== companyId) {
      return NextResponse.json({ error: 'Unauthorized to delete this unit' }, { status: 403 });
    }

    if (unit._count.items > 0) {
      return NextResponse.json(
        { error: `Cannot delete unit. It is currently used by ${unit._count.items} item(s).` },
        { status: 400 }
      );
    }

    await prisma.unit.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Unit deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete unit' }, { status: 500 });
  }
}

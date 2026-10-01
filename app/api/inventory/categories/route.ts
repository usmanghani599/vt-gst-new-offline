import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const categories = await prisma.itemCategory.findMany({
      where: { companyId: authContext.company.id },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ categories });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const companyId = authContext.company.id;

    // Check duplicate
    const existing = await prisma.itemCategory.findUnique({
      where: {
        companyId_name: {
          companyId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 400 });
    }

    const category = await prisma.itemCategory.create({
      data: {
        companyId,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create category' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description } = body;

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ error: 'Category ID and name are required' }, { status: 400 });
    }

    const companyId = authContext.company.id;

    const category = await prisma.itemCategory.findUnique({
      where: { id },
    });

    if (!category || category.companyId !== companyId) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const updated = await prisma.itemCategory.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, category: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update category' }, { status: 500 });
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
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const companyId = authContext.company.id;

    const category = await prisma.itemCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    if (!category || category.companyId !== companyId) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    if (category._count.items > 0) {
      return NextResponse.json(
        { error: `Cannot delete category. It is currently assigned to ${category._count.items} item(s).` },
        { status: 400 }
      );
    }

    await prisma.itemCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Category deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete category' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import prisma from '@/lib/db';
import { DocumentService } from '@/lib/services/document-service';

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
    const document = await prisma.document.findFirst({
      where: {
        id: resolvedParams.id,
        companyId: auth.company.id,
      },
      include: {
        party: true,
        items: {
          include: {
            item: true,
          },
        },
        taxes: true,
        transport: true,
        exportInfo: true,
        ledgerEntries: true,
        stockMovements: true,
        salesman: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch document' }, { status: 500 });
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
    const result = await DocumentService.deleteDocument(resolvedParams.id, auth.company.id);

    return NextResponse.json({
      success: true,
      message: `Document #${result.documentNumber} deleted successfully and all ledger/stock entries reversed.`,
    });
  } catch (error: any) {
    console.error('Delete document error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete document' },
      { status: 500 }
    );
  }
}

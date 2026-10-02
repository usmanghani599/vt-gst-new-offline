import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { DocumentService } from '@/lib/services/document-service';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const docType = searchParams.get('type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

    const companyId = authContext.company.id;
    const where: any = { companyId };
    if (docType) {
      where.documentType = docType;
    }

    const docs = await prisma.document.findMany({
      where,
      include: {
        party: true,
        items: true,
        paymentAllocations: {
          include: {
            payment: true,
          },
        },
        salesman: true,
      },
      orderBy: { documentDate: 'desc' },
      take: limit,
    });

    const serialized = docs.map((d) => ({
      id: d.id,
      documentNumber: d.documentNumber,
      documentType: d.documentType,
      documentDate: d.documentDate.toISOString(),
      partyId: d.partyId,
      billingPartyName: d.billingPartyName || d.party?.name || 'Walk-in Customer',
      billingGstin: d.billingGstin || d.party?.gstin,
      subTotal: Number(d.subTotal),
      taxTotal: Number(d.taxTotal),
      grandTotal: Number(d.grandTotal),
      paidAmount: Number(d.paidAmount),
      balanceAmount: Number(d.balanceAmount),
      status: d.status,
      paymentStatus: d.paymentStatus,
      paymentMode: d.paymentAllocations?.[0]?.payment?.paymentMode || 'CASH',
      items: d.items.map((i) => ({
        id: i.id,
        itemId: i.itemId,
        itemName: i.itemName,
        quantity: Number(i.quantity),
        unitRate: Number(i.unitRate),
        lineTotal: Number(i.totalAmount),
        unitName: i.unitName || 'PCS',
      })),
    }));

    return NextResponse.json({ documents: serialized });
  } catch (error: any) {
    console.error('Documents fetch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company || !authContext.financialYear) {
      return NextResponse.json({ error: 'Unauthorized or no active company context' }, { status: 401 });
    }

    if (authContext.financialYear.isClosed) {
      return NextResponse.json({ error: 'Cannot create transactions in a closed Financial Year' }, { status: 400 });
    }

    const body = await request.json();

    const doc = await DocumentService.createDocument({
      ...body,
      companyId: authContext.company.id,
      financialYearId: authContext.financialYear.id,
      userId: authContext.user.id,
    });

    return NextResponse.json({ success: true, document: doc });
  } catch (error: any) {
    console.error('Document creation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save document' }, { status: 400 });
  }
}

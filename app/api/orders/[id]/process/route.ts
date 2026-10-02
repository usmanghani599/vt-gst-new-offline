import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthContext } from '@/lib/auth';
import { DocumentService } from '@/lib/services/document-service';
import { OrderStatus, DocumentType, DocumentStatus, PaymentStatus } from '@prisma/client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const body = await req.json();
    const {
      items = [],
      notes,
      createInvoice = false,
      financialYearId,
      documentType = 'SALE',
    } = body;

    const order = await prisma.clientOrder.findFirst({
      where: {
        id: resolvedParams.id,
        companyId: auth.company.id,
      },
      include: {
        party: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    let subTotal = 0;
    let taxTotal = 0;
    let grandTotal = 0;

    const formattedItems = items.map((item: any) => {
      const qty = Number(item.quantity) || 1;
      const rate = Number(item.unitRate) || 0;
      const taxRate = Number(item.taxRate) || 0;
      const lineTaxable = qty * rate;
      const lineTax = (lineTaxable * taxRate) / 100;
      const lineTotal = lineTaxable + lineTax;

      subTotal += lineTaxable;
      taxTotal += lineTax;
      grandTotal += lineTotal;

      return {
        itemId: item.itemId || null,
        itemName: item.itemName,
        quantity: qty,
        unitName: item.unitName || 'Units',
        unitRate: rate,
        taxRate: taxRate,
        taxAmount: lineTax,
        totalAmount: lineTotal,
      };
    });

    // Delete existing client order items and replace with processed items
    await prisma.clientOrderItem.deleteMany({
      where: { orderId: order.id },
    });

    await prisma.clientOrderItem.createMany({
      data: formattedItems.map((item: any) => ({
        orderId: order.id,
        ...item,
      })),
    });

    let createdDocument = null;

    if (createInvoice && formattedItems.length > 0) {
      const fyId = financialYearId || auth.financialYear?.id;
      if (!fyId) {
        return NextResponse.json(
          { error: 'No active financial year found to generate invoice' },
          { status: 400 }
        );
      }

      // Prepare items for document service
      const docItems = formattedItems.map((it: any) => ({
        itemId: it.itemId || undefined,
        itemName: it.itemName,
        quantity: it.quantity,
        unitName: it.unitName,
        unitRate: it.unitRate,
        discountRate: 0,
        taxPercentage: it.taxRate,
      }));

      createdDocument = await DocumentService.createDocument({
        companyId: auth.company.id,
        financialYearId: fyId,
        documentType: documentType as DocumentType,
        documentDate: new Date(),
        partyId: order.partyId,
        billingPartyName: order.party.name,
        billingAddress: order.party.billingAddress || undefined,
        billingGstin: order.party.gstin || undefined,
        billingStateId: order.party.stateId || undefined,
        notes: `Converted from Client Order ${order.orderNumber}. ${notes || ''}`,
        items: docItems,
      });
    }

    // Update order status
    const updatedOrder = await prisma.clientOrder.update({
      where: { id: order.id },
      data: {
        status: createInvoice ? OrderStatus.COMPLETED : OrderStatus.IN_PROCESS,
        subTotal,
        taxTotal,
        grandTotal,
        notes: notes || order.notes,
        documentId: createdDocument?.id || order.documentId,
      },
      include: {
        items: true,
        attachments: true,
        document: true,
      },
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      document: createdDocument,
      message: createInvoice
        ? `Order successfully processed & Invoice ${createdDocument?.documentNumber} generated!`
        : 'Order items updated and moved to In Process.',
    });
  } catch (error: any) {
    console.error('Process order error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process order' },
      { status: 500 }
    );
  }
}

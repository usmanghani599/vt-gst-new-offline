import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import prisma from '@/lib/db';
import Decimal from 'decimal.js';
import { StockMovementType } from '@prisma/client';

export async function GET() {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = authContext.company.id;

    const items = await prisma.item.findMany({
      where: { companyId },
      include: {
        category: true,
        unit: true,
        taxRate: true,
        stockMovements: true,
      },
      orderBy: { name: 'asc' },
    });

    const serialized = items.map((item) => {
      let currentStock = new Decimal(item.openingStock);

      for (const m of item.stockMovements) {
        const qty = new Decimal(m.quantity);
        if (
          m.movementType === StockMovementType.PURCHASE_IN ||
          m.movementType === StockMovementType.SALE_RETURN_IN ||
          m.movementType === StockMovementType.ADJUSTMENT_IN
        ) {
          currentStock = currentStock.plus(qty);
        } else if (
          m.movementType === StockMovementType.SALE_OUT ||
          m.movementType === StockMovementType.PURCHASE_RETURN_OUT ||
          m.movementType === StockMovementType.ADJUSTMENT_OUT
        ) {
          currentStock = currentStock.minus(qty);
        }
      }

      const purchaseRate = new Decimal(item.purchasePrice);
      const stockValue = currentStock.times(purchaseRate).toDecimalPlaces(2);
      const minStock = new Decimal(item.minStockLevel);
      const isLowStock = !item.isService && currentStock.lessThanOrEqualTo(minStock);

      return {
        id: item.id,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        hsnSac: item.hsnSac,
        categoryId: item.categoryId,
        category: item.category ? { id: item.category.id, name: item.category.name } : null,
        categoryName: item.category?.name || 'General',
        unitId: item.unitId,
        unit: item.unit ? { id: item.unit.id, code: item.unit.code, name: item.unit.name } : null,
        unitName: item.unit?.code || 'PCS',
        taxRateId: item.taxRateId,
        taxRate: item.taxRate ? { id: item.taxRate.id, rate: Number(item.taxRate.rate), name: item.taxRate.name } : null,
        taxRateValue: item.taxRate ? Number(item.taxRate.rate) : 0.0,
        purchasePrice: purchaseRate.toNumber(),
        salesPrice: new Decimal(item.salesPrice).toNumber(),
        mrp: new Decimal(item.mrp).toNumber(),
        openingStock: new Decimal(item.openingStock).toNumber(),
        currentStock: currentStock.toNumber(),
        stockValue: stockValue.toNumber(),
        minStockLevel: minStock.toNumber(),
        reorderLevel: new Decimal(item.reorderLevel).toNumber(),
        isService: item.isService,
        isLowStock,
      };
    });

    return NextResponse.json({ items: serialized });
  } catch (error: any) {
    console.error('Items fetch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch items' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company || !authContext.financialYear) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      sku,
      barcode,
      hsnSac,
      categoryId,
      unitId,
      purchasePrice,
      salesPrice,
      mrp,
      taxRateId,
      openingStock,
      minStockLevel,
      reorderLevel,
      isService,
    } = body;

    if (!name || !unitId) {
      return NextResponse.json({ error: 'Item name and unit are required' }, { status: 400 });
    }

    const companyId = authContext.company.id;
    const fyId = authContext.financialYear.id;

    const createdItem = await prisma.$transaction(async (tx) => {
      const it = await tx.item.create({
        data: {
          companyId,
          categoryId: categoryId || null,
          name,
          sku: sku || null,
          barcode: barcode || null,
          hsnSac: hsnSac || null,
          unitId,
          purchasePrice: new Decimal(purchasePrice || 0).toNumber(),
          salesPrice: new Decimal(salesPrice || 0).toNumber(),
          mrp: new Decimal(mrp || 0).toNumber(),
          taxRateId: taxRateId || null,
          openingStock: new Decimal(openingStock || 0).toNumber(),
          openingStockValue: new Decimal(openingStock || 0).times(new Decimal(purchasePrice || 0)).toNumber(),
          minStockLevel: new Decimal(minStockLevel || 0).toNumber(),
          reorderLevel: new Decimal(reorderLevel || 0).toNumber(),
          isService: Boolean(isService),
        },
      });

      if (!isService && Number(openingStock || 0) > 0) {
        await tx.stockMovement.create({
          data: {
            companyId,
            financialYearId: fyId,
            itemId: it.id,
            movementType: 'OPENING_STOCK',
            quantity: new Decimal(openingStock).toNumber(),
            unitRate: new Decimal(purchasePrice || 0).toNumber(),
            totalValue: new Decimal(openingStock).times(new Decimal(purchasePrice || 0)).toNumber(),
            movementDate: new Date(),
            notes: 'Initial opening stock',
          },
        });
      }

      return it;
    });

    return NextResponse.json({ success: true, item: createdItem });
  } catch (error: any) {
    console.error('Item creation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create item' }, { status: 400 });
  }
}

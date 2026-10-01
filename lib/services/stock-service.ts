import Decimal from 'decimal.js';
import prisma from '@/lib/db';
import { StockMovementType } from '@prisma/client';

export class StockService {
  public static async getStockSummary(companyId: string) {
    const items = await prisma.item.findMany({
      where: { companyId, isService: false },
      include: {
        unit: true,
        category: true,
        taxRate: true,
        stockMovements: true,
      },
      orderBy: { name: 'asc' },
    });

    return items.map((item) => {
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
      const isLowStock = currentStock.lessThanOrEqualTo(minStock);

      return {
        id: item.id,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        category: item.category?.name || '-',
        unit: item.unit?.code || 'PCS',
        openingStock: new Decimal(item.openingStock).toNumber(),
        currentStock: currentStock.toNumber(),
        purchasePrice: purchaseRate.toNumber(),
        salesPrice: new Decimal(item.salesPrice).toNumber(),
        stockValue: stockValue.toNumber(),
        minStockLevel: minStock.toNumber(),
        isLowStock,
      };
    });
  }

  public static async getStockLedger(companyId: string, itemId: string) {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { unit: true },
    });
    if (!item || item.companyId !== companyId) throw new Error('Item not found');

    const movements = await prisma.stockMovement.findMany({
      where: { companyId, itemId },
      include: { document: true },
      orderBy: { movementDate: 'asc' },
    });

    let runningStock = new Decimal(item.openingStock);

    const rows = movements.map((m) => {
      const qty = new Decimal(m.quantity);
      let inQty = new Decimal(0);
      let outQty = new Decimal(0);

      if (
        m.movementType === StockMovementType.PURCHASE_IN ||
        m.movementType === StockMovementType.SALE_RETURN_IN ||
        m.movementType === StockMovementType.ADJUSTMENT_IN
      ) {
        inQty = qty;
        runningStock = runningStock.plus(qty);
      } else {
        outQty = qty;
        runningStock = runningStock.minus(qty);
      }

      return {
        id: m.id,
        date: m.movementDate,
        movementType: m.movementType,
        documentNumber: m.document?.documentNumber || '-',
        inQty: inQty.toNumber(),
        outQty: outQty.toNumber(),
        runningStock: runningStock.toNumber(),
        notes: m.notes || '',
      };
    });

    return {
      item: {
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit?.code || 'PCS',
        openingStock: new Decimal(item.openingStock).toNumber(),
      },
      rows,
      currentStock: runningStock.toNumber(),
    };
  }

  public static async recordAdjustment(params: {
    companyId: string;
    financialYearId: string;
    itemId: string;
    adjustmentType: 'IN' | 'OUT';
    quantity: number | string;
    notes?: string;
  }) {
    const qty = new Decimal(params.quantity);
    if (qty.lessThanOrEqualTo(0)) throw new Error('Quantity must be greater than zero');

    const item = await prisma.item.findUnique({
      where: { id: params.itemId },
    });
    if (!item) throw new Error('Item not found');

    const movementType =
      params.adjustmentType === 'IN'
        ? StockMovementType.ADJUSTMENT_IN
        : StockMovementType.ADJUSTMENT_OUT;

    return await prisma.stockMovement.create({
      data: {
        companyId: params.companyId,
        financialYearId: params.financialYearId,
        itemId: params.itemId,
        movementType,
        quantity: qty.toNumber(),
        unitRate: item.purchasePrice,
        totalValue: qty.times(new Decimal(item.purchasePrice)).toNumber(),
        movementDate: new Date(),
        notes: params.notes || 'Manual Stock Adjustment',
      },
    });
  }

  public static async recordBatchStockIn(params: {
    companyId: string;
    financialYearId: string;
    items: Array<{
      itemId: string;
      quantity: number | string;
      unitRate?: number | string;
      notes?: string;
    }>;
    generalNotes?: string;
  }) {
    if (!params.items || params.items.length === 0) {
      throw new Error('At least one item is required for stock inward');
    }

    const itemIds = params.items.map((i) => i.itemId);
    const dbItems = await prisma.item.findMany({
      where: {
        id: { in: itemIds },
        companyId: params.companyId,
      },
    });
    const dbItemMap = new Map(dbItems.map((it) => [it.id, it]));

    return await prisma.$transaction(async (tx) => {
      const movements = [];
      const now = new Date();

      for (const entry of params.items) {
        const item = dbItemMap.get(entry.itemId);
        if (!item) continue;

        const qty = new Decimal(entry.quantity || 0);
        if (qty.lessThanOrEqualTo(0)) continue;

        const rate = entry.unitRate !== undefined && entry.unitRate !== ''
          ? new Decimal(entry.unitRate)
          : new Decimal(item.purchasePrice);

        const movement = await tx.stockMovement.create({
          data: {
            companyId: params.companyId,
            financialYearId: params.financialYearId,
            itemId: item.id,
            movementType: StockMovementType.ADJUSTMENT_IN,
            quantity: qty.toNumber(),
            unitRate: rate.toNumber(),
            totalValue: qty.times(rate).toNumber(),
            movementDate: now,
            notes: entry.notes || params.generalNotes || 'Quick Barcode Stock In',
          },
        });
        movements.push(movement);
      }

      return movements;
    });
  }
}

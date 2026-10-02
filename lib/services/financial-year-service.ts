import Decimal from 'decimal.js';
import prisma from '@/lib/db';
import { LedgerService } from './ledger-service';
import { StockService } from './stock-service';

export class FinancialYearService {
  public static async closeAndRollover(params: {
    companyId: string;
    currentFyId: string;
    userId: string;
    nextFyName: string; // e.g. "2027-28"
    nextFyStartDate: Date | string;
    nextFyEndDate: Date | string;
  }) {
    const { companyId, currentFyId, userId, nextFyName, nextFyStartDate, nextFyEndDate } = params;

    const currentFy = await prisma.financialYear.findUnique({
      where: { id: currentFyId },
    });
    if (!currentFy || currentFy.companyId !== companyId) {
      throw new Error('Current financial year not found');
    }
    if (currentFy.isClosed) {
      throw new Error('This financial year is already closed');
    }

    // 1. Calculate Closing Party Balances
    const partyBalances = await LedgerService.getPartyBalances(companyId);

    // 2. Calculate Closing Stock
    const stockSummary = await StockService.getStockSummary(companyId);

    const snapshot = {
      closedAt: new Date(),
      closedByUserId: userId,
      priorFyName: currentFy.name,
      partyBalances,
      stockSummary,
    };

    return await prisma.$transaction(async (tx) => {
      // Mark current FY as closed
      await tx.financialYear.update({
        where: { id: currentFyId },
        data: {
          isClosed: true,
          closedAt: new Date(),
          closedByUserId: userId,
        },
      });

      // Save snapshot
      await tx.financialYearClosing.create({
        data: {
          financialYearId: currentFyId,
          snapshotData: JSON.stringify(snapshot),
        },
      });

      // Create Next Financial Year
      let nextFy = await tx.financialYear.findFirst({
        where: {
          companyId,
          name: nextFyName,
        },
      });

      if (!nextFy) {
        nextFy = await tx.financialYear.create({
          data: {
            companyId,
            name: nextFyName,
            startDate: new Date(nextFyStartDate),
            endDate: new Date(nextFyEndDate),
            isClosed: false,
          },
        });
      }

      // Update Parties with opening balances for new transactions
      for (const p of partyBalances) {
        const balDec = new Decimal(p.balance);
        const openingType = balDec.greaterThanOrEqualTo(0) ? 'DEBIT' : 'CREDIT';
        await tx.party.update({
          where: { id: p.id },
          data: {
            openingBalance: balDec.abs().toNumber(),
            openingBalanceType: openingType,
          },
        });
      }

      // Update Item Opening Stock
      for (const st of stockSummary) {
        await tx.item.update({
          where: { id: st.id },
          data: {
            openingStock: st.currentStock,
            openingStockValue: st.stockValue,
          },
        });
      }

      return {
        previousFy: currentFy.name,
        newFy: nextFy,
        carriedForwardPartiesCount: partyBalances.length,
        carriedForwardItemsCount: stockSummary.length,
      };
    });
  }
}

import Decimal from 'decimal.js';
import prisma from '@/lib/db';

export interface PartyLedgerOptions {
  companyId: string;
  partyId: string;
  financialYearId?: string;
  fromDate?: Date | string;
  toDate?: Date | string;
}

export class LedgerService {
  public static async getPartyLedger(options: PartyLedgerOptions) {
    const { companyId, partyId, fromDate, toDate } = options;

    const party = await prisma.party.findUnique({
      where: { id: partyId },
    });
    if (!party || party.companyId !== companyId) {
      throw new Error('Party not found');
    }

    const whereClause: any = {
      companyId,
      partyId,
    };

    if (fromDate || toDate) {
      whereClause.entryDate = {};
      if (fromDate) whereClause.entryDate.gte = new Date(fromDate);
      if (toDate) whereClause.entryDate.lte = new Date(toDate);
    }

    const entries = await prisma.ledgerEntry.findMany({
      where: whereClause,
      include: {
        document: true,
        payment: {
          select: {
            id: true,
            paymentNumber: true,
            paymentType: true,
            paymentMode: true,
            referenceNumber: true,
            chequeNumber: true,
            attachmentUrl: true,
          },
        },
      },
      orderBy: { entryDate: 'asc' },
    });

    // Compute running balance
    let runningBalance = new Decimal(
      party.openingBalanceType === 'DEBIT' ? party.openingBalance : party.openingBalance.negated()
    );

    const items = entries.map((entry) => {
      const debit = new Decimal(entry.debit);
      const credit = new Decimal(entry.credit);
      runningBalance = runningBalance.plus(debit).minus(credit);

      return {
        id: entry.id,
        date: entry.entryDate,
        accountHead: entry.accountHead,
        documentNumber: entry.document?.documentNumber || entry.payment?.paymentNumber || '-',
        documentType: entry.document?.documentType || (entry.payment?.paymentType === 'IN_RECEIPT' ? 'RECEIPT' : entry.payment?.paymentType === 'OUT_PAYMENT' ? 'PAYMENT' : 'MANUAL'),
        narration: entry.narration || '',
        paymentMode: entry.payment?.paymentMode || null,
        referenceNumber: entry.payment?.referenceNumber || entry.payment?.chequeNumber || null,
        attachmentUrl: entry.payment?.attachmentUrl || null,
        debit: debit.toNumber(),
        credit: credit.toNumber(),
        runningBalance: runningBalance.toNumber(),
      };
    });

    return {
      party: {
        id: party.id,
        name: party.name,
        legalName: party.legalName,
        gstin: party.gstin,
        mobile: party.mobile,
        openingBalance: new Decimal(party.openingBalance).toNumber(),
        openingBalanceType: party.openingBalanceType,
      },
      entries: items,
      finalBalance: runningBalance.toNumber(),
    };
  }

  public static async getPartyBalances(companyId: string, partyType?: 'CUSTOMER' | 'SUPPLIER') {
    const where: any = { companyId };
    if (partyType) where.partyType = { in: [partyType, 'BOTH'] };

    const parties = await prisma.party.findMany({
      where,
      include: {
        ledgerEntries: true,
      },
      orderBy: { name: 'asc' },
    });

    return parties.map((p) => {
      let balance = new Decimal(
        p.openingBalanceType === 'DEBIT' ? p.openingBalance : p.openingBalance.negated()
      );

      for (const entry of p.ledgerEntries) {
        balance = balance.plus(new Decimal(entry.debit)).minus(new Decimal(entry.credit));
      }

      return {
        id: p.id,
        name: p.name,
        partyType: p.partyType,
        gstin: p.gstin,
        phone: p.phone || p.mobile,
        city: p.city,
        creditLimit: new Decimal(p.creditLimit).toNumber(),
        balance: balance.toNumber(),
        balanceType: balance.greaterThanOrEqualTo(0) ? 'RECEIVABLE' : 'PAYABLE',
      };
    });
  }

  public static async getDayBook(
    companyId: string,
    options?: {
      date?: string;
      fromDate?: string;
      toDate?: string;
      filterType?: string;
    } | string | Date
  ) {
    let dateParam: string | undefined;
    let fromDateParam: string | undefined;
    let toDateParam: string | undefined;
    let filterTypeParam: string | undefined;

    if (typeof options === 'string' || options instanceof Date) {
      dateParam = typeof options === 'string' ? options : options.toISOString().split('T')[0];
    } else if (options) {
      dateParam = options.date;
      fromDateParam = options.fromDate;
      toDateParam = options.toDate;
      filterTypeParam = options.filterType;
    }

    const where: any = { companyId };

    if (fromDateParam || toDateParam) {
      where.entryDate = {};
      if (fromDateParam) {
        const start = new Date(fromDateParam);
        start.setHours(0, 0, 0, 0);
        where.entryDate.gte = start;
      }
      if (toDateParam) {
        const end = new Date(toDateParam);
        end.setHours(23, 59, 59, 999);
        where.entryDate.lte = end;
      }
    } else if (dateParam) {
      const start = new Date(dateParam);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateParam);
      end.setHours(23, 59, 59, 999);
      where.entryDate = { gte: start, lte: end };
    }

    if (filterTypeParam === 'CASH_BANK') {
      where.accountHead = 'BANK_OR_CASH';
    } else if (filterTypeParam === 'RECEIVABLES') {
      where.accountHead = 'ACCOUNTS_RECEIVABLE';
    } else if (filterTypeParam === 'PAYABLES') {
      where.accountHead = 'ACCOUNTS_PAYABLE';
    }

    let entries = await prisma.ledgerEntry.findMany({
      where,
      include: {
        party: true,
        document: true,
        payment: true,
      },
      orderBy: { entryDate: 'desc' },
    });

    // Fallback: If no records on requested single date, fetch recent records so user can see their data
    if (entries.length === 0 && dateParam && !fromDateParam && !toDateParam) {
      const fallback = await prisma.ledgerEntry.findMany({
        where: { companyId },
        include: {
          party: true,
          document: true,
          payment: true,
        },
        orderBy: { entryDate: 'desc' },
        take: 50,
      });

      if (fallback.length > 0) {
        return {
          entries: fallback,
          isFallback: true,
          queriedDate: dateParam,
        };
      }
    }

    return {
      entries,
      isFallback: false,
      queriedDate: dateParam || fromDateParam || 'All',
    };
  }
}

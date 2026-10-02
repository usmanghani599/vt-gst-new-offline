import Decimal from 'decimal.js';
import prisma from '@/lib/db';
import {
  DocumentType,
  DocumentStatus,
  PaymentStatus,
  StockMovementType,
  PointTransactionType,
  TaxMode,
  PaymentMode,
} from '@prisma/client';
import { TaxCalculationService, TaxCalculationInputItem } from './tax-service';

export interface CreateDocumentInput {
  companyId: string;
  financialYearId: string;
  userId?: string;
  documentType: DocumentType;
  documentDate: Date | string;
  dueDate?: Date | string;
  partyId?: string;
  billingPartyName?: string;
  billingAddress?: string;
  billingStateId?: string;
  billingGstin?: string;
  shippingAddress?: string;
  shippingStateId?: string;
  placeOfSupplyStateId?: string;
  reverseCharge?: boolean;
  taxMode?: TaxMode;
  currencyCode?: string;
  exchangeRate?: number | string;
  freightCharges?: number | string;
  packingCharges?: number | string;
  otherCharges?: number | string;
  salesmanId?: string;
  notes?: string;
  termsConditions?: string;
  paidAmount?: number | string;
  paymentMode?: PaymentMode;
  bankAccountId?: string;
  // Transport & Export metadata
  transport?: {
    transporterName?: string;
    transporterId?: string;
    vehicleNumber?: string;
    lrNumber?: string;
    lrDate?: Date | string;
    distanceKm?: number;
    transportMode?: string;
    ewayBillNumber?: string;
    ewayBillDate?: Date | string;
  };
  exportInfo?: {
    exportType?: 'WITH_PAYMENT_OF_TAX' | 'WITHOUT_PAYMENT_OF_TAX_UNDER_LUT';
    lutNumber?: string;
    portCode?: string;
    shippingBillNumber?: string;
    shippingBillDate?: Date | string;
    foreignCurrencyCode?: string;
    exchangeRate?: number | string;
    foreignAmount?: number | string;
  };
  items: Array<{
    itemId?: string;
    itemName: string;
    hsnSac?: string;
    quantity: number | string;
    unitName?: string;
    unitRate: number | string;
    discountRate?: number | string;
    taxRateId?: string;
    taxPercentage?: number | string;
    cessRatePercentage?: number | string;
  }>;
}

import { deviceNumberTag, getDeviceSeriesCode } from '@/lib/desktop-local/runtime';

export class DocumentService {
  public static async getNextDocumentNumber(
    companyId: string,
    financialYearId: string,
    documentType: DocumentType
  ): Promise<string> {
    const fy = await prisma.financialYear.findUnique({
      where: { id: financialYearId },
    });
    if (!fy) throw new Error('Financial year not found');

    const prefixMap: Record<DocumentType, string> = {
      SALE: 'INV',
      PURCHASE: 'PUR',
      POS: 'POS',
      ESTIMATE: 'EST',
      BILL_OF_SUPPLY: 'BOS',
      CREDIT_NOTE: 'CN',
      DEBIT_NOTE: 'DN',
      EXPORT_INVOICE: 'EXP',
      JOB_WORK: 'JW',
      SALES_RETURN: 'SR',
      PURCHASE_RETURN: 'PR',
    };

    // Desktop: once synced with online, each computer numbers in its own series (e.g. DK7Q-INV/2026-27/00001)
    const deviceSeries = getDeviceSeriesCode();
    const basePrefix = `${prefixMap[documentType] || 'DOC'}/${fy.name}`;
    const defaultPrefix = deviceSeries ? `${deviceSeries}-${basePrefix}` : basePrefix;

    return await prisma.$transaction(async (tx) => {
      let series = await tx.documentSeries.findFirst({
        where: {
          companyId,
          financialYearId,
          documentType,
          ...(deviceSeries ? { prefix: defaultPrefix } : {}),
        },
      });

      if (!series) {
        series = await tx.documentSeries.create({
          data: {
            companyId,
            financialYearId,
            documentType,
            prefix: defaultPrefix,
            nextNumber: 1,
            isDefault: true,
          },
        });
      }

      const currentNumber = series.nextNumber;
      await tx.documentSeries.update({
        where: { id: series.id },
        data: { nextNumber: currentNumber + 1 },
      });

      const formattedNumber = String(currentNumber).padStart(5, '0');
      return `${series.prefix}/${formattedNumber}`;
    });
  }

  public static async createDocument(input: CreateDocumentInput) {
    // 1. Validate Company & Financial Year
    const company = await prisma.company.findUnique({
      where: { id: input.companyId },
      include: { state: true },
    });
    if (!company) throw new Error('Company not found');

    const fy = await prisma.financialYear.findUnique({
      where: { id: input.financialYearId },
    });
    if (!fy) throw new Error('Financial year not found');
    if (fy.isClosed) throw new Error('Cannot create transaction in a closed Financial Year');

    // 2. Resolve Party & State Codes
    let party: any = null;
    let placeOfSupplyStateCodeGst = company.state?.stateCodeGst || '27';

    if (input.partyId) {
      party = await prisma.party.findUnique({
        where: { id: input.partyId },
        include: { state: true },
      });
      if (party?.state?.stateCodeGst) {
        placeOfSupplyStateCodeGst = party.state.stateCodeGst;
      }
    }

    // Validation: Customer Name & Mobile are mandatory for UPI / QR Billing
    if (input.paymentMode === PaymentMode.UPI) {
      const hasParty = party && !party.isWalkIn;
      const partyMobile = hasParty ? (party.mobile || party.phone) : null;
      const partyName = hasParty ? party.name : input.billingPartyName;

      if (!partyName || partyName.toLowerCase().includes('walk-in') || !partyMobile || partyMobile.trim().length < 7) {
        throw new Error('Customer Name and Mobile Number are mandatory for UPI / QR Billing. Please select or add the customer with a valid mobile number.');
      }
    }

    if (input.placeOfSupplyStateId) {
      const posState = await prisma.state.findUnique({
        where: { id: input.placeOfSupplyStateId },
      });
      if (posState?.stateCodeGst) {
        placeOfSupplyStateCodeGst = posState.stateCodeGst;
      }
    }

    const supplierStateCodeGst = company.state?.stateCodeGst || '27';
    const effectiveTaxMode = input.taxMode || company.defaultTaxMode;
    const isExportLUT = input.exportInfo?.exportType === 'WITHOUT_PAYMENT_OF_TAX_UNDER_LUT';

    // 3. Run Tax Calculation Engine
    const taxInputItems: TaxCalculationInputItem[] = input.items.map((it) => ({
      itemId: it.itemId,
      itemName: it.itemName,
      hsnSac: it.hsnSac,
      quantity: it.quantity,
      unitRate: it.unitRate,
      discountRate: it.discountRate || 0,
      taxRatePercentage: it.taxPercentage || 0,
      cessRatePercentage: it.cessRatePercentage || 0,
      taxRateId: it.taxRateId,
    }));

    const calcResult = TaxCalculationService.calculate({
      documentType: input.documentType,
      taxMode: effectiveTaxMode,
      supplierStateCodeGst,
      placeOfSupplyStateCodeGst,
      isReverseCharge: Boolean(input.reverseCharge),
      isExportWithLUT: isExportLUT,
      freightCharges: input.freightCharges || 0,
      packingCharges: input.packingCharges || 0,
      otherCharges: input.otherCharges || 0,
      items: taxInputItems,
    });

    const docDate = new Date(input.documentDate);
    const dueDate = input.dueDate ? new Date(input.dueDate) : null;

    const paidAmountDec = new Decimal(input.paidAmount || 0);
    let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;
    if (paidAmountDec.greaterThanOrEqualTo(calcResult.grandTotal)) {
      paymentStatus = PaymentStatus.PAID;
    } else if (paidAmountDec.greaterThan(0)) {
      paymentStatus = PaymentStatus.PARTIALLY_PAID;
    }
    const balanceAmount = Decimal.max(0, calcResult.grandTotal.minus(paidAmountDec));

    // 4. Reserve Document Number
    const documentNumber = await this.getNextDocumentNumber(
      input.companyId,
      input.financialYearId,
      input.documentType
    );

    // 5. Execute Atomic Database Transaction
    return await prisma.$transaction(async (tx) => {
      // Create Document
      const doc = await tx.document.create({
        data: {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          documentNumber,
          documentType: input.documentType,
          documentDate: docDate,
          dueDate,
          partyId: input.partyId,
          billingPartyName: input.billingPartyName || (party ? party.name : 'Walk-in Customer'),
          billingAddress: input.billingAddress || (party ? party.billingAddress : null),
          billingStateId: input.billingStateId || (party ? party.stateId : null),
          billingGstin: input.billingGstin || (party ? party.gstin : null),
          shippingAddress: input.shippingAddress || (party ? party.shippingAddress : null),
          shippingStateId: input.shippingStateId || (party ? party.stateId : null),
          placeOfSupplyStateId: input.placeOfSupplyStateId || (party ? party.stateId : null),
          reverseCharge: Boolean(input.reverseCharge),
          taxMode: effectiveTaxMode,
          currencyCode: input.currencyCode || company.currencyCode || 'INR',
          exchangeRate: new Decimal(input.exchangeRate || 1.0).toNumber(),
          subTotal: calcResult.subTotal.toNumber(),
          taxTotal: calcResult.taxTotal.plus(calcResult.cessTotal).toNumber(),
          discountTotal: calcResult.discountTotal.toNumber(),
          freightCharges: calcResult.freightCharges.toNumber(),
          packingCharges: calcResult.packingCharges.toNumber(),
          otherCharges: calcResult.otherCharges.toNumber(),
          roundOff: calcResult.roundOff.toNumber(),
          grandTotal: calcResult.grandTotal.toNumber(),
          paidAmount: paidAmountDec.toNumber(),
          balanceAmount: balanceAmount.toNumber(),
          status: DocumentStatus.POSTED,
          paymentStatus,
          salesmanId: input.salesmanId,
          notes: input.notes,
          termsConditions: input.termsConditions,
          createdByUserId: input.userId,
        },
      });

      // Create Document Items
      for (let i = 0; i < calcResult.items.length; i++) {
        const itemResult = calcResult.items[i];
        const origItem = input.items[i];

        await tx.documentItem.create({
          data: {
            documentId: doc.id,
            itemId: itemResult.itemId,
            itemName: itemResult.itemName,
            hsnSac: itemResult.hsnSac,
            quantity: itemResult.quantity.toNumber(),
            unitName: origItem.unitName || 'PCS',
            unitRate: itemResult.unitRate.toNumber(),
            grossAmount: itemResult.grossAmount.toNumber(),
            discountRate: itemResult.discountRate.toNumber(),
            discountAmount: itemResult.discountAmount.toNumber(),
            taxableAmount: itemResult.taxableAmount.toNumber(),
            taxRateId: itemResult.taxRateId,
            taxPercentage: itemResult.taxPercentage.toNumber(),
            taxAmount: itemResult.taxAmount.toNumber(),
            cessRate: itemResult.cessRate.toNumber(),
            cessAmount: itemResult.cessAmount.toNumber(),
            totalAmount: itemResult.totalAmount.toNumber(),
          },
        });

        // Stock movements for inventory items
        if (itemResult.itemId && input.documentType !== DocumentType.ESTIMATE) {
          let stockMovementType: StockMovementType | null = null;
          let stockQty = itemResult.quantity;

          if (input.documentType === DocumentType.SALE || input.documentType === DocumentType.POS || input.documentType === DocumentType.EXPORT_INVOICE) {
            stockMovementType = StockMovementType.SALE_OUT;
          } else if (input.documentType === DocumentType.PURCHASE) {
            stockMovementType = StockMovementType.PURCHASE_IN;
          } else if (input.documentType === DocumentType.CREDIT_NOTE || input.documentType === DocumentType.SALES_RETURN) {
            stockMovementType = StockMovementType.SALE_RETURN_IN;
          } else if (input.documentType === DocumentType.DEBIT_NOTE || input.documentType === DocumentType.PURCHASE_RETURN) {
            stockMovementType = StockMovementType.PURCHASE_RETURN_OUT;
          }

          if (stockMovementType) {
            await tx.stockMovement.create({
              data: {
                companyId: input.companyId,
                financialYearId: input.financialYearId,
                itemId: itemResult.itemId,
                documentId: doc.id,
                movementType: stockMovementType,
                quantity: stockQty.toNumber(),
                unitRate: itemResult.unitRate.toNumber(),
                totalValue: itemResult.taxableAmount.toNumber(),
                movementDate: docDate,
                notes: `${input.documentType} #${documentNumber}`,
              },
            });
          }
        }
      }

      // Create Document Taxes
      for (const tax of calcResult.taxSummary) {
        if (tax.taxAmount.greaterThan(0)) {
          await tx.documentTax.create({
            data: {
              documentId: doc.id,
              taxTypeCode: tax.taxTypeCode,
              taxRatePercentage: tax.taxRatePercentage.toNumber(),
              taxableAmount: tax.taxableAmount.toNumber(),
              taxAmount: tax.taxAmount.toNumber(),
            },
          });
        }
      }

      // Create Transport info if provided
      if (input.transport && (input.transport.vehicleNumber || input.transport.ewayBillNumber || input.transport.transporterName)) {
        await tx.documentTransport.create({
          data: {
            documentId: doc.id,
            transporterName: input.transport.transporterName,
            transporterId: input.transport.transporterId,
            vehicleNumber: input.transport.vehicleNumber,
            lrNumber: input.transport.lrNumber,
            lrDate: input.transport.lrDate ? new Date(input.transport.lrDate) : null,
            distanceKm: input.transport.distanceKm,
            transportMode: input.transport.transportMode,
            ewayBillNumber: input.transport.ewayBillNumber,
            ewayBillDate: input.transport.ewayBillDate ? new Date(input.transport.ewayBillDate) : null,
          },
        });
      }

      // Create Export metadata if export invoice
      if (input.exportInfo && input.documentType === DocumentType.EXPORT_INVOICE) {
        await tx.documentExport.create({
          data: {
            documentId: doc.id,
            exportType: input.exportInfo.exportType || 'WITHOUT_PAYMENT_OF_TAX_UNDER_LUT',
            lutNumber: input.exportInfo.lutNumber,
            portCode: input.exportInfo.portCode,
            shippingBillNumber: input.exportInfo.shippingBillNumber,
            shippingBillDate: input.exportInfo.shippingBillDate ? new Date(input.exportInfo.shippingBillDate) : null,
            foreignCurrencyCode: input.exportInfo.foreignCurrencyCode || 'USD',
            exchangeRate: new Decimal(input.exportInfo.exchangeRate || 1.0).toNumber(),
            foreignAmount: new Decimal(input.exportInfo.foreignAmount || 0).toNumber(),
          },
        });
      }

      // Double-Entry Ledger Entries (Except Estimates)
      if (input.documentType !== DocumentType.ESTIMATE) {
        const grandTotal = calcResult.grandTotal.toNumber();

        const effectivePartyId = input.partyId || (await this.getOrCreateWalkInParty(tx, input.companyId)).id;

        if (input.documentType === DocumentType.SALE || input.documentType === DocumentType.POS || input.documentType === DocumentType.EXPORT_INVOICE || input.documentType === DocumentType.BILL_OF_SUPPLY) {
          // Party Debit (Receivable)
          await tx.ledgerEntry.create({
            data: {
              companyId: input.companyId,
              financialYearId: input.financialYearId,
              partyId: effectivePartyId,
              documentId: doc.id,
              entryDate: docDate,
              accountHead: 'ACCOUNTS_RECEIVABLE',
              debit: grandTotal,
              credit: 0,
              narration: `${input.documentType} #${documentNumber}`,
            },
          });

          // If paid on spot (e.g. POS or immediate payment)
          if (paidAmountDec.greaterThan(0)) {
            const paymentNumber = `RCP/${fy.name}/${deviceNumberTag()}${String(Math.floor(1000 + Math.random() * 9000))}`;
            const payment = await tx.payment.create({
              data: {
                companyId: input.companyId,
                financialYearId: input.financialYearId,
                paymentType: 'IN_RECEIPT',
                paymentNumber,
                paymentDate: docDate,
                partyId: effectivePartyId,
                amount: paidAmountDec.toNumber(),
                paymentMode: input.paymentMode || PaymentMode.CASH,
                bankAccountId: input.bankAccountId,
                notes: `Auto payment against ${documentNumber}`,
                createdByUserId: input.userId,
              },
            });

            await tx.paymentAllocation.create({
              data: {
                paymentId: payment.id,
                documentId: doc.id,
                allocatedAmount: paidAmountDec.toNumber(),
              },
            });

            // Credit Party for payment received
            await tx.ledgerEntry.create({
              data: {
                companyId: input.companyId,
                financialYearId: input.financialYearId,
                partyId: effectivePartyId,
                documentId: doc.id,
                paymentId: payment.id,
                entryDate: docDate,
                accountHead: 'BANK_OR_CASH',
                debit: 0,
                credit: paidAmountDec.toNumber(),
                narration: `Payment received for #${documentNumber}`,
              },
            });
          }
        } else if (input.documentType === DocumentType.PURCHASE) {
          // Supplier Credit (Payable)
          await tx.ledgerEntry.create({
            data: {
              companyId: input.companyId,
              financialYearId: input.financialYearId,
              partyId: effectivePartyId,
              documentId: doc.id,
              entryDate: docDate,
              accountHead: 'ACCOUNTS_PAYABLE',
              debit: 0,
              credit: grandTotal,
              narration: `Purchase Invoice #${documentNumber}`,
            },
          });
        } else if (input.documentType === DocumentType.CREDIT_NOTE) {
          // Party Credit (Reducing Receivable)
          if (input.partyId) {
            await tx.ledgerEntry.create({
              data: {
                companyId: input.companyId,
                financialYearId: input.financialYearId,
                partyId: input.partyId,
                documentId: doc.id,
                entryDate: docDate,
                accountHead: 'SALES_RETURN',
                debit: 0,
                credit: grandTotal,
                narration: `Credit Note #${documentNumber}`,
              },
            });
          }
        } else if (input.documentType === DocumentType.DEBIT_NOTE) {
          // Supplier Debit (Reducing Payable)
          if (input.partyId) {
            await tx.ledgerEntry.create({
              data: {
                companyId: input.companyId,
                financialYearId: input.financialYearId,
                partyId: input.partyId,
                documentId: doc.id,
                entryDate: docDate,
                accountHead: 'PURCHASE_RETURN',
                debit: grandTotal,
                credit: 0,
                narration: `Debit Note #${documentNumber}`,
              },
            });
          }
        }
      }

      // Customer Loyalty Points Accrual (1% of grandTotal on Retail Sales & POS)
      if (input.partyId && (input.documentType === DocumentType.SALE || input.documentType === DocumentType.POS)) {
        const targetParty = party || (await tx.party.findUnique({ where: { id: input.partyId } }));
        if (targetParty && !targetParty.isWalkIn) {
          const earnedLoyaltyPoints = calcResult.grandTotal
            .times(0.01) // 1% loyalty points (1 point per ₹100 spent)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

          if (earnedLoyaltyPoints.greaterThan(0)) {
            let loyaltyAccount = await tx.loyaltyAccount.findUnique({
              where: { partyId: input.partyId },
            });

            if (!loyaltyAccount) {
              loyaltyAccount = await tx.loyaltyAccount.create({
                data: {
                  partyId: input.partyId,
                  currentPoints: 0,
                  totalEarned: 0,
                  totalRedeemed: 0,
                },
              });
            }

            await tx.loyaltyTransaction.create({
              data: {
                loyaltyAccountId: loyaltyAccount.id,
                documentId: doc.id,
                type: PointTransactionType.CREDIT,
                points: earnedLoyaltyPoints.toNumber(),
                redemptionAmount: 0,
                notes: `Loyalty reward for ${input.documentType} #${documentNumber}`,
              },
            });

            await tx.loyaltyAccount.update({
              where: { id: loyaltyAccount.id },
              data: {
                currentPoints: new Decimal(loyaltyAccount.currentPoints).plus(earnedLoyaltyPoints).toNumber(),
                totalEarned: new Decimal(loyaltyAccount.totalEarned).plus(earnedLoyaltyPoints).toNumber(),
              },
            });
          }
        }
      }

      // Salesman Points Accrual
      if (input.salesmanId && (input.documentType === DocumentType.SALE || input.documentType === DocumentType.POS)) {
        const salesman = await tx.salesman.findUnique({
          where: { id: input.salesmanId },
        });
        if (salesman && new Decimal(salesman.pointsPerAmount || 0).greaterThan(0)) {
          const earnedPoints = calcResult.grandTotal
            .times(new Decimal(salesman.pointsPerAmount))
            .dividedBy(100)
            .toDecimalPlaces(2);

          if (earnedPoints.greaterThan(0)) {
            await tx.salesmanPointTransaction.create({
              data: {
                salesmanId: salesman.id,
                documentId: doc.id,
                type: PointTransactionType.CREDIT,
                points: earnedPoints.toNumber(),
                amount: calcResult.grandTotal.toNumber(),
                notes: `Points for ${input.documentType} #${documentNumber}`,
              },
            });
          }
        }
      }

      return doc;
    });
  }

  public static async deleteDocument(documentId: string, companyId: string) {
    return await prisma.$transaction(async (tx) => {
      const doc = await tx.document.findFirst({
        where: { id: documentId, companyId },
        include: {
          loyaltyTransactions: true,
          salesmanPoints: true,
        },
      });

      if (!doc) {
        throw new Error('Document not found or unauthorized');
      }

      // 1. Revert loyalty points if any
      for (const lt of doc.loyaltyTransactions) {
        if (lt.type === PointTransactionType.CREDIT) {
          const loyaltyAcc = await tx.loyaltyAccount.findUnique({
            where: { id: lt.loyaltyAccountId },
          });
          if (loyaltyAcc) {
            await tx.loyaltyAccount.update({
              where: { id: loyaltyAcc.id },
              data: {
                currentPoints: Math.max(0, Number(loyaltyAcc.currentPoints) - Number(lt.points)),
                totalEarned: Math.max(0, Number(loyaltyAcc.totalEarned) - Number(lt.points)),
              },
            });
          }
        }
      }

      // 2. Unlink any client orders
      await tx.clientOrder.updateMany({
        where: { documentId: doc.id },
        data: { documentId: null },
      });

      // 3. Delete dependent records
      await tx.loyaltyTransaction.deleteMany({ where: { documentId: doc.id } });
      await tx.salesmanPointTransaction.deleteMany({ where: { documentId: doc.id } });
      await tx.stockMovement.deleteMany({ where: { documentId: doc.id } });
      await tx.ledgerEntry.deleteMany({ where: { documentId: doc.id } });
      await tx.paymentAllocation.deleteMany({ where: { documentId: doc.id } });
      await tx.documentDelivery.deleteMany({ where: { documentId: doc.id } });
      await tx.documentReference.deleteMany({ where: { OR: [{ documentId: doc.id }, { referencedDocumentId: doc.id }] } });
      await tx.documentTransport.deleteMany({ where: { documentId: doc.id } });
      await tx.documentExport.deleteMany({ where: { documentId: doc.id } });
      await tx.documentTax.deleteMany({ where: { documentId: doc.id } });
      await tx.documentItem.deleteMany({ where: { documentId: doc.id } });

      // 4. Delete the document
      await tx.document.delete({
        where: { id: doc.id },
      });

      return { success: true, documentNumber: doc.documentNumber };
    });
  }

  private static async getOrCreateWalkInParty(tx: any, companyId: string) {
    let walkIn = await tx.party.findFirst({
      where: { companyId, isWalkIn: true },
    });
    if (!walkIn) {
      walkIn = await tx.party.create({
        data: {
          companyId,
          name: 'Walk-in Customer',
          partyType: 'CUSTOMER',
          isWalkIn: true,
          gstRegType: 'CONSUMER',
        },
      });
    }
    return walkIn;
  }
}

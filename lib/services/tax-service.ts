import Decimal from 'decimal.js';
import { TaxMode, DocumentType } from '@prisma/client';

export interface TaxCalculationInputItem {
  id?: string;
  itemId?: string;
  itemName: string;
  hsnSac?: string;
  quantity: Decimal.Value | number | string;
  unitRate: Decimal.Value | number | string;
  discountRate?: Decimal.Value | number | string; // % discount
  taxPercentage?: Decimal.Value | number | string; // e.g. 18.00
  taxRatePercentage?: Decimal.Value | number | string; // e.g. 18.00
  cessRatePercentage?: Decimal.Value | number | string; // e.g. 12.00
  taxRateId?: string;
}

export interface TaxCalculationParams {
  documentType: DocumentType;
  taxMode: TaxMode;
  supplierStateCodeGst?: string | null;
  placeOfSupplyStateCodeGst?: string | null;
  isReverseCharge?: boolean;
  isExportWithLUT?: boolean;
  freightCharges?: Decimal.Value | number | string;
  packingCharges?: Decimal.Value | number | string;
  otherCharges?: Decimal.Value | number | string;
  items: TaxCalculationInputItem[];
}

export interface CalculatedTaxComponent {
  taxTypeCode: string;
  taxRatePercentage: Decimal;
  taxableAmount: Decimal;
  taxAmount: Decimal;
}

export interface CalculatedItemResult {
  itemId?: string;
  itemName: string;
  hsnSac?: string;
  quantity: Decimal;
  unitRate: Decimal;
  grossAmount: Decimal;
  discountRate: Decimal;
  discountAmount: Decimal;
  taxableAmount: Decimal;
  taxRateId?: string;
  taxPercentage: Decimal;
  taxAmount: Decimal;
  cessRate: Decimal;
  cessAmount: Decimal;
  totalAmount: Decimal;
  components: CalculatedTaxComponent[];
}

export interface TaxCalculationResult {
  taxMode: TaxMode;
  isIntraState: boolean;
  subTotal: Decimal;
  discountTotal: Decimal;
  taxableTotal: Decimal;
  taxTotal: Decimal;
  cessTotal: Decimal;
  freightCharges: Decimal;
  packingCharges: Decimal;
  otherCharges: Decimal;
  roundOff: Decimal;
  grandTotal: Decimal;
  items: CalculatedItemResult[];
  taxSummary: CalculatedTaxComponent[];
}

export class TaxCalculationService {
  public static calculate(params: TaxCalculationParams): TaxCalculationResult {
    const {
      documentType,
      taxMode,
      supplierStateCodeGst,
      placeOfSupplyStateCodeGst,
      isReverseCharge = false,
      isExportWithLUT = false,
      freightCharges = 0,
      packingCharges = 0,
      otherCharges = 0,
      items,
    } = params;

    const freightDec = new Decimal(freightCharges || 0);
    const packingDec = new Decimal(packingCharges || 0);
    const otherDec = new Decimal(otherCharges || 0);

    // Intra-state rule: Supplier State Code == Place of Supply State Code
    // If either state code is missing, default to Intra-state unless marked inter-state
    const isIntraState =
      !isExportWithLUT &&
      Boolean(
        supplierStateCodeGst &&
        placeOfSupplyStateCodeGst &&
        supplierStateCodeGst === placeOfSupplyStateCodeGst
      );

    const isTaxExemptDocument = documentType === DocumentType.BILL_OF_SUPPLY || isExportWithLUT;

    let subTotalAccum = new Decimal(0);
    let discountTotalAccum = new Decimal(0);
    let taxableTotalAccum = new Decimal(0);
    let taxTotalAccum = new Decimal(0);
    let cessTotalAccum = new Decimal(0);

    const calculatedItems: CalculatedItemResult[] = [];
    const taxSummaryMap: Record<string, { taxTypeCode: string; taxRatePercentage: Decimal; taxableAmount: Decimal; taxAmount: Decimal }> = {};

    for (const item of items) {
      const qty = new Decimal(item.quantity || 0);
      const rate = new Decimal(item.unitRate || 0);
      const grossAmount = qty.times(rate);
      const discRate = new Decimal(item.discountRate || 0);
      const discAmount = grossAmount.times(discRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const netGross = grossAmount.minus(discAmount);

      const itemTaxRate = item.taxPercentage !== undefined ? item.taxPercentage : item.taxRatePercentage;
      const effectiveTaxRate = isTaxExemptDocument ? new Decimal(0) : new Decimal(itemTaxRate || 0);
      const effectiveCessRate = isTaxExemptDocument ? new Decimal(0) : new Decimal(item.cessRatePercentage || 0);

      let taxableAmount = new Decimal(0);
      let taxAmount = new Decimal(0);
      let cessAmount = new Decimal(0);
      let itemTotal = new Decimal(0);

      if (taxMode === TaxMode.TAX_INCLUSIVE && !isTaxExemptDocument && effectiveTaxRate.greaterThan(0)) {
        // Inclusive mode: Gross contains tax
        const totalRate = effectiveTaxRate.plus(effectiveCessRate);
        const divisor = new Decimal(1).plus(totalRate.dividedBy(100));
        taxableAmount = netGross.dividedBy(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        taxAmount = taxableAmount.times(effectiveTaxRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        cessAmount = taxableAmount.times(effectiveCessRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        itemTotal = netGross;
      } else {
        // Exclusive mode
        taxableAmount = netGross.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        taxAmount = isTaxExemptDocument
          ? new Decimal(0)
          : taxableAmount.times(effectiveTaxRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        cessAmount = isTaxExemptDocument
          ? new Decimal(0)
          : taxableAmount.times(effectiveCessRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        itemTotal = taxableAmount.plus(taxAmount).plus(cessAmount);
      }

      // Generate tax components
      const components: CalculatedTaxComponent[] = [];
      if (!isTaxExemptDocument && effectiveTaxRate.greaterThan(0)) {
        if (isIntraState) {
          const halfRate = effectiveTaxRate.dividedBy(2);
          const halfTax = taxAmount.dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          components.push({
            taxTypeCode: 'CGST',
            taxRatePercentage: halfRate,
            taxableAmount,
            taxAmount: halfTax,
          });
          components.push({
            taxTypeCode: 'SGST',
            taxRatePercentage: halfRate,
            taxableAmount,
            taxAmount: taxAmount.minus(halfTax), // Ensure exact sum
          });
        } else {
          components.push({
            taxTypeCode: 'IGST',
            taxRatePercentage: effectiveTaxRate,
            taxableAmount,
            taxAmount,
          });
        }
      }

      if (!isTaxExemptDocument && effectiveCessRate.greaterThan(0)) {
        components.push({
          taxTypeCode: 'CESS',
          taxRatePercentage: effectiveCessRate,
          taxableAmount,
          taxAmount: cessAmount,
        });
      }

      // Aggregate into summary map
      for (const comp of components) {
        const key = `${comp.taxTypeCode}_${comp.taxRatePercentage.toFixed(2)}`;
        if (!taxSummaryMap[key]) {
          taxSummaryMap[key] = {
            taxTypeCode: comp.taxTypeCode,
            taxRatePercentage: comp.taxRatePercentage,
            taxableAmount: new Decimal(0),
            taxAmount: new Decimal(0),
          };
        }
        taxSummaryMap[key].taxableAmount = taxSummaryMap[key].taxableAmount.plus(comp.taxableAmount);
        taxSummaryMap[key].taxAmount = taxSummaryMap[key].taxAmount.plus(comp.taxAmount);
      }

      subTotalAccum = subTotalAccum.plus(grossAmount);
      discountTotalAccum = discountTotalAccum.plus(discAmount);
      taxableTotalAccum = taxableTotalAccum.plus(taxableAmount);
      taxTotalAccum = taxTotalAccum.plus(taxAmount);
      cessTotalAccum = cessTotalAccum.plus(cessAmount);

      calculatedItems.push({
        itemId: item.itemId,
        itemName: item.itemName,
        hsnSac: item.hsnSac,
        quantity: qty,
        unitRate: rate,
        grossAmount,
        discountRate: discRate,
        discountAmount: discAmount,
        taxableAmount,
        taxRateId: item.taxRateId,
        taxPercentage: effectiveTaxRate,
        taxAmount,
        cessRate: effectiveCessRate,
        cessAmount,
        totalAmount: itemTotal,
        components,
      });
    }

    const unroundedTotal = taxableTotalAccum
      .plus(taxTotalAccum)
      .plus(cessTotalAccum)
      .plus(freightDec)
      .plus(packingDec)
      .plus(otherDec);

    const grandTotal = unroundedTotal.round();
    const roundOff = grandTotal.minus(unroundedTotal);

    return {
      taxMode,
      isIntraState,
      subTotal: subTotalAccum.toDecimalPlaces(2),
      discountTotal: discountTotalAccum.toDecimalPlaces(2),
      taxableTotal: taxableTotalAccum.toDecimalPlaces(2),
      taxTotal: taxTotalAccum.toDecimalPlaces(2),
      cessTotal: cessTotalAccum.toDecimalPlaces(2),
      freightCharges: freightDec.toDecimalPlaces(2),
      packingCharges: packingDec.toDecimalPlaces(2),
      otherCharges: otherDec.toDecimalPlaces(2),
      roundOff: roundOff.toDecimalPlaces(2),
      grandTotal: grandTotal.toDecimalPlaces(2),
      items: calculatedItems,
      taxSummary: Object.values(taxSummaryMap),
    };
  }
}

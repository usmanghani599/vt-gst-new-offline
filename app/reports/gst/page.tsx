import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import Decimal from 'decimal.js';
import { Receipt, FileSpreadsheet } from 'lucide-react';

export default async function GstSummaryPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;

  // Fetch all posted sales documents and their tax rows
  const salesDocs = await prisma.document.findMany({
    where: {
      companyId,
      documentType: { in: ['SALE', 'POS', 'EXPORT_INVOICE'] },
      status: 'POSTED',
    },
    include: {
      party: true,
      taxes: true,
      items: true,
    },
  });

  // 1. Tax Component Aggregation
  let totalTaxable = new Decimal(0);
  let totalCgst = new Decimal(0);
  let totalSgst = new Decimal(0);
  let totalIgst = new Decimal(0);
  let totalCess = new Decimal(0);

  for (const doc of salesDocs) {
    totalTaxable = totalTaxable.plus(new Decimal(doc.subTotal));
    for (const tx of doc.taxes) {
      const amt = new Decimal(tx.taxAmount);
      if (tx.taxTypeCode === 'CGST') totalCgst = totalCgst.plus(amt);
      else if (tx.taxTypeCode === 'SGST') totalSgst = totalSgst.plus(amt);
      else if (tx.taxTypeCode === 'IGST') totalIgst = totalIgst.plus(amt);
      else if (tx.taxTypeCode === 'CESS') totalCess = totalCess.plus(amt);
    }
  }

  // 2. HSN / SAC Aggregation
  const hsnMap: Record<string, { hsn: string; name: string; qty: Decimal; taxable: Decimal; tax: Decimal }> = {};
  for (const doc of salesDocs) {
    for (const it of doc.items) {
      const hsn = it.hsnSac || 'OTHER';
      if (!hsnMap[hsn]) {
        hsnMap[hsn] = {
          hsn,
          name: it.itemName,
          qty: new Decimal(0),
          taxable: new Decimal(0),
          tax: new Decimal(0),
        };
      }
      hsnMap[hsn].qty = hsnMap[hsn].qty.plus(new Decimal(it.quantity));
      hsnMap[hsn].taxable = hsnMap[hsn].taxable.plus(new Decimal(it.taxableAmount));
      hsnMap[hsn].tax = hsnMap[hsn].tax.plus(new Decimal(it.taxAmount));
    }
  }

  // 3. B2B vs B2C Breakdown
  let b2bCount = 0;
  let b2bTaxable = new Decimal(0);
  let b2bTax = new Decimal(0);

  let b2cCount = 0;
  let b2cTaxable = new Decimal(0);
  let b2cTax = new Decimal(0);

  for (const doc of salesDocs) {
    const hasGstin = Boolean(doc.billingGstin || doc.party?.gstin);
    if (hasGstin) {
      b2bCount++;
      b2bTaxable = b2bTaxable.plus(new Decimal(doc.subTotal));
      b2bTax = b2bTax.plus(new Decimal(doc.taxTotal));
    } else {
      b2cCount++;
      b2cTaxable = b2cTaxable.plus(new Decimal(doc.subTotal));
      b2cTax = b2cTax.plus(new Decimal(doc.taxTotal));
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">GST Filing & Tax Summary</h1>
          <p className="text-xs text-slate-500">
            Real-time tax liability breakdowns, HSN/SAC summary, and B2B vs B2C compliance reporting
          </p>
        </div>

        {/* GST Component Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase">CGST (Central Tax)</span>
            <div className="text-xl font-black text-sky-700 mt-1">{formatCurrency(totalCgst)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase">SGST (State Tax)</span>
            <div className="text-xl font-black text-sky-700 mt-1">{formatCurrency(totalSgst)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase">IGST (Integrated Tax)</span>
            <div className="text-xl font-black text-indigo-700 mt-1">{formatCurrency(totalIgst)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Output GST</span>
            <div className="text-xl font-black text-slate-900 mt-1">
              {formatCurrency(totalCgst.plus(totalSgst).plus(totalIgst).plus(totalCess))}
            </div>
          </div>
        </div>

        {/* B2B vs B2C Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">B2B Supplies (Registered)</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                {b2bCount} Invoices
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-500">Taxable Value:</span>
                <div className="font-bold text-slate-900 mt-0.5">{formatCurrency(b2bTaxable)}</div>
              </div>
              <div>
                <span className="text-slate-500">Total Tax:</span>
                <div className="font-bold text-sky-700 mt-0.5">{formatCurrency(b2bTax)}</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">B2C Supplies (Consumer / POS)</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {b2cCount} Bills
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-500">Taxable Value:</span>
                <div className="font-bold text-slate-900 mt-0.5">{formatCurrency(b2cTaxable)}</div>
              </div>
              <div>
                <span className="text-slate-500">Total Tax:</span>
                <div className="font-bold text-emerald-700 mt-0.5">{formatCurrency(b2cTax)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* HSN / SAC Summary Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">HSN / SAC Wise Outward Summary</h3>
          </div>
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">HSN / SAC Code</th>
                <th className="p-3.5">Product Description</th>
                <th className="p-3.5 text-right">Total Quantity</th>
                <th className="p-3.5 text-right">Taxable Turnover (₹)</th>
                <th className="p-3.5 text-right">Total GST (₹)</th>
                <th className="p-3.5 text-right">Total Invoiced (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.values(hsnMap).map((h) => (
                <tr key={h.hsn} className="hover:bg-slate-50/80 transition">
                  <td className="p-3.5 font-mono font-bold text-sky-700">{h.hsn}</td>
                  <td className="p-3.5 font-medium text-slate-800">{h.name}</td>
                  <td className="p-3.5 text-right font-semibold">{formatQuantity(h.qty)}</td>
                  <td className="p-3.5 text-right font-medium">{formatCurrency(h.taxable)}</td>
                  <td className="p-3.5 text-right font-bold text-sky-700">{formatCurrency(h.tax)}</td>
                  <td className="p-3.5 text-right font-black text-slate-900">
                    {formatCurrency(h.taxable.plus(h.tax))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';
import Decimal from 'decimal.js';
import { BarChart3, Download } from 'lucide-react';

interface ReportProps {
  searchParams: Promise<{ fromDate?: string; toDate?: string }>;
}

export default async function SalesReportPage({ searchParams }: ReportProps) {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;
  const resolvedSearchParams = await searchParams;
  const fromDate = resolvedSearchParams?.fromDate;
  const toDate = resolvedSearchParams?.toDate;

  const userRole = authContext.company.role;
  const userId = authContext.user.id;

  const where: any = {
    companyId,
    documentType: { in: ['SALE', 'POS', 'EXPORT_INVOICE'] },
    status: 'POSTED',
  };

  // Restrict POS operators to their own sales
  if (userRole === 'POS_OPERATOR') {
    where.createdByUserId = userId;
  } else if (userRole === 'SALESMAN') {
    // Find salesman record linked to this user or company
    const salesmanRecord = await prisma.salesman.findFirst({
      where: {
        companyId,
        OR: [
          { userId },
          { email: authContext.user.email },
        ],
      },
    });

    if (salesmanRecord) {
      where.OR = [
        { salesmanId: salesmanRecord.id },
        { createdByUserId: userId },
      ];
    } else {
      where.createdByUserId = userId;
    }
  }

  if (fromDate || toDate) {
    where.documentDate = {};
    if (fromDate) where.documentDate.gte = new Date(fromDate);
    if (toDate) where.documentDate.lte = new Date(toDate);
  }

  const invoices = await prisma.document.findMany({
    where,
    include: { party: true, taxes: true },
    orderBy: { documentDate: 'asc' },
  });

  let totalTaxable = new Decimal(0);
  let totalTax = new Decimal(0);
  let grandTotal = new Decimal(0);

  for (const inv of invoices) {
    totalTaxable = totalTaxable.plus(new Decimal(inv.subTotal));
    totalTax = totalTax.plus(new Decimal(inv.taxTotal));
    grandTotal = grandTotal.plus(new Decimal(inv.grandTotal));
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sales Register & Tax Report</h1>
            <p className="text-xs text-slate-500">
              Live comprehensive audit of all finalized sales invoices, taxable turnovers, and output taxes
            </p>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <form method="GET" className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">From Date</label>
              <input
                type="date"
                name="fromDate"
                defaultValue={fromDate}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">To Date</label>
              <input
                type="date"
                name="toDate"
                defaultValue={toDate}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <button
              type="submit"
              className="mt-4 px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition"
            >
              Generate Report
            </button>
          </form>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Taxable Turnover</span>
            <div className="text-xl font-black text-slate-900 mt-1">{formatCurrency(totalTaxable)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Output GST</span>
            <div className="text-xl font-black text-sky-600 mt-1">{formatCurrency(totalTax)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Sales Volume</span>
            <div className="text-xl font-black text-slate-900 mt-1">{formatCurrency(grandTotal)}</div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Doc #</th>
                <th className="p-3">Party Name</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3 text-right">Taxable (₹)</th>
                <th className="p-3 text-right">GST (₹)</th>
                <th className="p-3 text-right">Round Off</th>
                <th className="p-3 text-right">Invoice Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3 text-slate-600">{formatDate(inv.documentDate)}</td>
                  <td className="p-3 font-mono font-bold text-sky-700">{inv.documentNumber}</td>
                  <td className="p-3 font-semibold text-slate-800">
                    {inv.billingPartyName || inv.party?.name || 'Walk-in'}
                  </td>
                  <td className="p-3 font-mono text-slate-500">{inv.billingGstin || inv.party?.gstin || '-'}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(inv.subTotal, '')}</td>
                  <td className="p-3 text-right font-medium text-sky-700">{formatCurrency(inv.taxTotal, '')}</td>
                  <td className="p-3 text-right text-slate-500">{formatCurrency(inv.roundOff, '')}</td>
                  <td className="p-3 text-right font-black text-slate-900">{formatCurrency(inv.grandTotal, '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

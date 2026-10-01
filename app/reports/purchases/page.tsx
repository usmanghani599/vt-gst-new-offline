import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';
import Decimal from 'decimal.js';

interface ReportProps {
  searchParams: Promise<{ fromDate?: string; toDate?: string }>;
}

export default async function PurchaseReportPage({ searchParams }: ReportProps) {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;
  const resolvedSearchParams = await searchParams;
  const fromDate = resolvedSearchParams?.fromDate;
  const toDate = resolvedSearchParams?.toDate;

  const where: any = {
    companyId,
    documentType: 'PURCHASE',
    status: 'POSTED',
  };

  if (fromDate || toDate) {
    where.documentDate = {};
    if (fromDate) where.documentDate.gte = new Date(fromDate);
    if (toDate) where.documentDate.lte = new Date(toDate);
  }

  const purchases = await prisma.document.findMany({
    where,
    include: { party: true },
    orderBy: { documentDate: 'asc' },
  });

  let totalTaxable = new Decimal(0);
  let totalInputTax = new Decimal(0);
  let grandTotal = new Decimal(0);

  for (const p of purchases) {
    totalTaxable = totalTaxable.plus(new Decimal(p.subTotal));
    totalInputTax = totalInputTax.plus(new Decimal(p.taxTotal));
    grandTotal = grandTotal.plus(new Decimal(p.grandTotal));
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Purchase Register & ITC Report</h1>
          <p className="text-xs text-slate-500">
            Audit of all vendor bills, purchase expenditures, and Input Tax Credit (ITC) eligibility
          </p>
        </div>

        {/* Date Filter */}
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
              Filter Report
            </button>
          </form>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Taxable Purchases</span>
            <div className="text-xl font-black text-slate-900 mt-1">{formatCurrency(totalTaxable)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase">Input Tax Credit (ITC)</span>
            <div className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(totalInputTax)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase">Gross Purchase Expenditure</span>
            <div className="text-xl font-black text-slate-900 mt-1">{formatCurrency(grandTotal)}</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Doc #</th>
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Supplier GSTIN</th>
                <th className="p-3 text-right">Taxable Amount</th>
                <th className="p-3 text-right">Input GST</th>
                <th className="p-3 text-right">Total Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3 text-slate-600">{formatDate(p.documentDate)}</td>
                  <td className="p-3 font-mono font-bold text-sky-700">{p.documentNumber}</td>
                  <td className="p-3 font-semibold text-slate-800">{p.billingPartyName || p.party?.name}</td>
                  <td className="p-3 font-mono text-slate-500">{p.billingGstin || p.party?.gstin || '-'}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(p.subTotal, '')}</td>
                  <td className="p-3 text-right font-medium text-emerald-700">{formatCurrency(p.taxTotal, '')}</td>
                  <td className="p-3 text-right font-black text-slate-900">{formatCurrency(p.grandTotal, '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

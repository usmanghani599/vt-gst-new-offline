import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Plus, ShoppingCart, Printer } from 'lucide-react';

export default async function PurchasesPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const purchases = await prisma.document.findMany({
    where: {
      companyId: authContext.company.id,
      documentType: 'PURCHASE',
    },
    include: { party: true },
    orderBy: { documentDate: 'desc' },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Purchase Invoices</h1>
            <p className="text-xs text-slate-500">
              Record supplier bills, manage inbound inventory, and claim Input Tax Credit (ITC)
            </p>
          </div>
          <Link
            href="/purchases/new"
            className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Record Purchase Invoice
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Purchase Doc #</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Vendor / Supplier</th>
                <th className="p-3.5">Supplier GSTIN</th>
                <th className="p-3.5 text-right">Taxable Amount</th>
                <th className="p-3.5 text-right">Input GST</th>
                <th className="p-3.5 text-right">Total Invoice</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-600">No Purchase Invoices Found</p>
                  </td>
                </tr>
              ) : (
                purchases.map((pur) => (
                  <tr key={pur.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-sky-700">{pur.documentNumber}</td>
                    <td className="p-3.5 text-slate-600">{formatDate(pur.documentDate)}</td>
                    <td className="p-3.5 font-semibold text-slate-800">
                      {pur.billingPartyName || pur.party?.name}
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">
                      {pur.billingGstin || pur.party?.gstin || '-'}
                    </td>
                    <td className="p-3.5 text-right">{formatCurrency(pur.subTotal)}</td>
                    <td className="p-3.5 text-right font-medium text-emerald-700">{formatCurrency(pur.taxTotal)}</td>
                    <td className="p-3.5 text-right font-bold text-slate-900 text-sm">{formatCurrency(pur.grandTotal)}</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {pur.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <Link
                        href={`/sales/invoices/${pur.id}`}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-sky-600 font-semibold bg-slate-100 px-2.5 py-1 rounded transition"
                      >
                        <Printer className="h-3.5 w-3.5" /> View / Print
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

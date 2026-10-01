import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Plus, Search, FileText, Printer } from 'lucide-react';

export default async function EstimatesPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const estimates = await prisma.document.findMany({
    where: {
      companyId: authContext.company.id,
      documentType: 'ESTIMATE',
    },
    include: { party: true },
    orderBy: { documentDate: 'desc' },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Quotations & Estimates</h1>
            <p className="text-xs text-slate-500">
              Create and manage customer estimates and convert them into sales invoices
            </p>
          </div>
          <Link
            href="/sales/invoices/new"
            className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> New Estimate
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Estimate #</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Party Name</th>
                <th className="p-3.5 text-right">Taxable Value</th>
                <th className="p-3.5 text-right">Estimate Total</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {estimates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-600">No Estimates Created Yet</p>
                  </td>
                </tr>
              ) : (
                estimates.map((est) => (
                  <tr key={est.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-sky-700">{est.documentNumber}</td>
                    <td className="p-3.5 text-slate-600">{formatDate(est.documentDate)}</td>
                    <td className="p-3.5 font-semibold text-slate-800">
                      {est.billingPartyName || est.party?.name || 'Walk-in Customer'}
                    </td>
                    <td className="p-3.5 text-right">{formatCurrency(est.subTotal)}</td>
                    <td className="p-3.5 text-right font-bold text-slate-900">{formatCurrency(est.grandTotal)}</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {est.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <Link
                        href={`/sales/invoices/${est.id}`}
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

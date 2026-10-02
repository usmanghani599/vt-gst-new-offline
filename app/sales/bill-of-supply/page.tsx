import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Plus, FileText, Printer } from 'lucide-react';

export default async function BillOfSupplyPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const docs = await prisma.document.findMany({
    where: {
      companyId: authContext.company.id,
      documentType: 'BILL_OF_SUPPLY',
    },
    include: { party: true },
    orderBy: { documentDate: 'desc' },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bill of Supply (BOS)</h1>
            <p className="text-xs text-slate-500">
              Invoices for composition dealers, exempt goods, and non-taxable supplies
            </p>
          </div>
          <Link
            href="/sales/invoices/new"
            className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> New Bill of Supply
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">BOS Number</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Party Name</th>
                <th className="p-3.5 text-right">Total Amount</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-600">No Bill of Supply Documents Found</p>
                  </td>
                </tr>
              ) : (
                docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-sky-700">{doc.documentNumber}</td>
                    <td className="p-3.5 text-slate-600">{formatDate(doc.documentDate)}</td>
                    <td className="p-3.5 font-semibold text-slate-800">
                      {doc.billingPartyName || doc.party?.name || 'Walk-in Customer'}
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-900">{formatCurrency(doc.grandTotal)}</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <Link
                        href={`/sales/invoices/${doc.id}`}
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

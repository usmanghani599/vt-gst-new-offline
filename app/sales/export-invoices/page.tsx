import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Plus, FileText, Printer, Globe } from 'lucide-react';

export default async function ExportInvoicesPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const exportDocs = await prisma.document.findMany({
    where: {
      companyId: authContext.company.id,
      documentType: 'EXPORT_INVOICE',
    },
    include: { party: true, exportInfo: true },
    orderBy: { documentDate: 'desc' },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Export Invoices</h1>
            <p className="text-xs text-slate-500">
              Foreign export invoices with LUT reference, foreign currency, and conversion
            </p>
          </div>
          <Link
            href="/sales/invoices/new"
            className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> New Export Invoice
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Export Doc #</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Foreign Buyer</th>
                <th className="p-3.5">Export Type / LUT</th>
                <th className="p-3.5 text-right">Foreign Value</th>
                <th className="p-3.5 text-right">INR Value</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exportDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-600">No Export Invoices Found</p>
                  </td>
                </tr>
              ) : (
                exportDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-sky-700">{doc.documentNumber}</td>
                    <td className="p-3.5 text-slate-600">{formatDate(doc.documentDate)}</td>
                    <td className="p-3.5 font-semibold text-slate-800">
                      {doc.billingPartyName || doc.party?.name}
                    </td>
                    <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                      {doc.exportInfo?.lutNumber ? `LUT: ${doc.exportInfo.lutNumber}` : 'With Tax'}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-800">
                      {doc.exportInfo?.foreignCurrencyCode || 'USD'} {Number(doc.exportInfo?.foreignAmount || 0).toFixed(2)}
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

import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Plus, Search, FileText, Printer, ArrowUpDown, Store } from 'lucide-react';
import { InvoiceActionButtons } from '@/components/invoice-action-buttons';

interface InvoicesPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function SalesInvoicesPage({ searchParams }: InvoicesPageProps) {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const company = authContext.company;
  const companyId = company.id;
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams?.q || '';
  const page = parseInt(resolvedSearchParams?.page || '1', 10);
  const pageSize = 15;

  const where: any = {
    companyId,
    documentType: { in: ['SALE', 'POS', 'EXPORT_INVOICE'] },
  };

  if (query) {
    where.OR = [
      { documentNumber: { contains: query } },
      { billingPartyName: { contains: query } },
      { billingGstin: { contains: query } },
    ];
  }

  const [totalCount, invoices] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      include: { party: true, items: true },
      orderBy: { documentDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sales & POS Invoices</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              GST Invoices, retail POS receipts, and Bluetooth thermal printing
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/sales/pos"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-sm transition inline-flex items-center gap-1.5"
            >
              <Store className="h-4 w-4" /> POS Counter
            </Link>

            <Link
              href="/sales/invoices/new"
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-sm transition inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> New Tax Invoice
            </Link>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between gap-4">
          <form method="GET" className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search invoice #, customer name, GSTIN..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50/50 font-medium"
            />
          </form>

          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            Showing <strong>{invoices.length}</strong> of <strong>{totalCount}</strong> invoices
          </div>
        </div>

        {/* Mobile View: Touch-Friendly Invoice Cards (Hidden on Large Screens) */}
        <div className="lg:hidden space-y-3">
          {invoices.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-slate-600 text-xs">No Invoices Found</p>
            </div>
          ) : (
            invoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                      {inv.documentType}
                    </span>
                    <h3 className="text-sm font-black text-slate-900 mt-1">
                      {inv.documentNumber}
                    </h3>
                    <p className="text-xs text-slate-600 font-semibold mt-0.5">
                      {inv.billingPartyName || inv.party?.name || 'Walk-in Customer'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-slate-900">
                      {formatCurrency(inv.grandTotal)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {formatDate(inv.documentDate)}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {inv.status}
                  </span>
                  <InvoiceActionButtons invoice={inv} company={company} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Table (Hidden on Mobile) */}
        <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Party / Customer</th>
                  <th className="p-3.5">GSTIN</th>
                  <th className="p-3.5 text-right">Taxable Value</th>
                  <th className="p-3.5 text-right">Tax Total</th>
                  <th className="p-3.5 text-right">Grand Total</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-slate-600">No Invoices Found</p>
                      <p className="text-[11px] mt-1">Create your first GST invoice using the button above.</p>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-mono font-bold text-sky-700">
                        <Link href={`/sales/invoices/${inv.id}`} className="hover:underline">
                          {inv.documentNumber}
                        </Link>
                      </td>
                      <td className="p-3.5 text-slate-600">{formatDate(inv.documentDate)}</td>
                      <td className="p-3.5 font-semibold text-slate-800">
                        {inv.billingPartyName || inv.party?.name || 'Walk-in Customer'}
                      </td>
                      <td className="p-3.5 font-mono text-slate-500">
                        {inv.billingGstin || inv.party?.gstin || '-'}
                      </td>
                      <td className="p-3.5 text-right font-medium text-slate-700">
                        {formatCurrency(inv.subTotal)}
                      </td>
                      <td className="p-3.5 text-right font-medium text-slate-700">
                        {formatCurrency(inv.taxTotal)}
                      </td>
                      <td className="p-3.5 text-right font-bold text-slate-900 text-sm">
                        {formatCurrency(inv.grandTotal)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <InvoiceActionButtons invoice={inv} company={company} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div>Page {page} of {totalPages}</div>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/sales/invoices?page=${page - 1}&q=${encodeURIComponent(query)}`}
                    className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 font-semibold"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/sales/invoices?page=${page + 1}&q=${encodeURIComponent(query)}`}
                    className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 font-semibold"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

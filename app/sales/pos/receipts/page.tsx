import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Store, Search, Printer, Receipt, Plus, ArrowLeft } from 'lucide-react';
import { PosReceiptActions } from './pos-receipt-actions';

interface PosReceiptsPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function PosReceiptsPage({ searchParams }: PosReceiptsPageProps) {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams?.q || '';
  const page = parseInt(resolvedSearchParams?.page || '1', 10);
  const pageSize = 15;

  const where: any = {
    companyId,
    documentType: 'POS',
  };

  if (query) {
    where.OR = [
      { documentNumber: { contains: query } },
      { billingPartyName: { contains: query } },
    ];
  }

  const [totalCount, posReceipts] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      include: {
        party: true,
        items: true,
        salesman: true,
      },
      orderBy: { documentDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/sales/pos"
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                title="Back to POS Counter"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">POS Receipts & Invoices</h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete history of retail counter bills, walk-in sales, and thermal receipts
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/sales/pos"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition inline-flex items-center gap-2"
            >
              <Store className="h-4 w-4" /> Open POS Billing Counter
            </Link>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
          <form method="GET" className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search by Bill # or customer name..."
              className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </form>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong>{posReceipts.length}</strong> of <strong>{totalCount}</strong> POS bills
          </div>
        </div>

        {/* POS Receipts Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Bill / Receipt #</th>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5 text-center">Items</th>
                  <th className="p-3.5 text-right">Taxable Value</th>
                  <th className="p-3.5 text-right">GST Total</th>
                  <th className="p-3.5 text-right">Grand Total</th>
                  <th className="p-3.5 text-center">Cashier / Staff</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {posReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-slate-600">No POS Invoices Found</p>
                      <p className="text-[11px] mt-1">Open the Retail POS Counter to generate your first retail bill.</p>
                    </td>
                  </tr>
                ) : (
                  posReceipts.map((pos) => (
                    <tr key={pos.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-mono font-bold text-emerald-700">
                        <Link href={`/sales/invoices/${pos.id}`} className="hover:underline">
                          {pos.documentNumber}
                        </Link>
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {formatDate(pos.documentDate)}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-800">
                        {pos.billingPartyName || pos.party?.name || 'Walk-in Retail Customer'}
                      </td>
                      <td className="p-3.5 text-center font-semibold text-slate-600">
                        {pos.items.length}
                      </td>
                      <td className="p-3.5 text-right font-medium text-slate-700">
                        {formatCurrency(pos.subTotal)}
                      </td>
                      <td className="p-3.5 text-right font-medium text-slate-700">
                        {Number(pos.taxTotal) > 0 ? formatCurrency(pos.taxTotal) : <span className="text-slate-400">Non-GST</span>}
                      </td>
                      <td className="p-3.5 text-right font-bold text-slate-900 text-sm">
                        {formatCurrency(pos.grandTotal)}
                      </td>
                      <td className="p-3.5 text-center text-slate-600 font-medium">
                        {pos.salesman?.name || 'Counter'}
                      </td>
                      <td className="p-3.5 text-center">
                        <PosReceiptActions receipt={pos} company={authContext.company} />
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
                    href={`/sales/pos/receipts?page=${page - 1}&q=${encodeURIComponent(query)}`}
                    className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 font-semibold"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/sales/pos/receipts?page=${page + 1}&q=${encodeURIComponent(query)}`}
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

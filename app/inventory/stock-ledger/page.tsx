import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { StockService } from '@/lib/services/stock-service';
import { formatDate, formatQuantity } from '@/lib/utils';
import Link from 'next/link';
import { Package, ArrowLeft } from 'lucide-react';

interface StockLedgerPageProps {
  searchParams: Promise<{ itemId?: string }>;
}

export default async function StockLedgerPage({ searchParams }: StockLedgerPageProps) {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;
  const resolvedSearchParams = await searchParams;
  const items = await prisma.item.findMany({
    where: { companyId, isService: false },
    orderBy: { name: 'asc' },
  });

  const selectedItemId = resolvedSearchParams?.itemId || items[0]?.id;
  let ledgerData: any = null;

  if (selectedItemId) {
    ledgerData = await StockService.getStockLedger(companyId, selectedItemId);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stock Movement Ledger</h1>
            <p className="text-xs text-slate-500">
              Audit all physical inventory additions, deductions, sales, purchases, and manual adjustments
            </p>
          </div>
          <Link
            href="/inventory/items"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Catalog
          </Link>
        </div>

        {/* Item Selector Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
            Select Product:
          </label>
          <form method="GET" className="flex-1 max-w-md">
            <select
              name="itemId"
              defaultValue={selectedItemId}
              // auto-submit on change
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-sky-500"
            >
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} (SKU: {it.sku || '-'})
                </option>
              ))}
            </select>
          </form>

          {ledgerData && (
            <div className="ml-auto text-right">
              <span className="text-xs text-slate-500">Current On-Hand: </span>
              <strong className="text-sm font-black text-sky-700">
                {formatQuantity(ledgerData.currentStock)} {ledgerData.item.unit}
              </strong>
            </div>
          )}
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Movement Type</th>
                <th className="p-3.5">Reference Doc #</th>
                <th className="p-3.5 text-right">Inward (In)</th>
                <th className="p-3.5 text-right">Outward (Out)</th>
                <th className="p-3.5 text-right">Balance Stock</th>
                <th className="p-3.5">Narration / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!ledgerData || ledgerData.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-600">No Movements Recorded for this Item</p>
                  </td>
                </tr>
              ) : (
                ledgerData.rows.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 text-slate-600">{formatDate(r.date)}</td>
                    <td className="p-3.5 font-semibold text-slate-800">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.inQty > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {r.movementType}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-700 font-medium">{r.documentNumber}</td>
                    <td className="p-3.5 text-right font-bold text-emerald-600">
                      {r.inQty > 0 ? `+${formatQuantity(r.inQty)}` : '-'}
                    </td>
                    <td className="p-3.5 text-right font-bold text-rose-600">
                      {r.outQty > 0 ? `-${formatQuantity(r.outQty)}` : '-'}
                    </td>
                    <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                      {formatQuantity(r.runningStock)} {ledgerData.item.unit}
                    </td>
                    <td className="p-3.5 text-slate-500">{r.notes || '-'}</td>
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

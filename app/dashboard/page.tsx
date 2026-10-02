import React from 'react';
import { getAuthContext, hasFeature } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import Decimal from 'decimal.js';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import {
  TrendingUp,
  FileText,
  Users,
  AlertTriangle,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Award,
} from 'lucide-react';
import Link from 'next/link';

import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const authContext = await getAuthContext();
  if (!authContext) {
    redirect('/login');
  }

  if (authContext.user.isSuperAdmin) {
    redirect('/admin');
  }

  if (!authContext.company) {
    return null;
  }

  const companyId = authContext.company.id;
  const fyId = authContext.financialYear?.id;

  // 1. Fetch Sales Aggregates, Purchase Aggregates, Recent Invoices, Parties, and Stock in parallel
  const [salesAgg, purchaseAgg, recentTransactions, parties, items] = await Promise.all([
    prisma.document.aggregate({
      where: {
        companyId,
        documentType: { in: ['SALE', 'POS', 'EXPORT_INVOICE'] },
        status: 'POSTED',
      },
      _sum: { grandTotal: true, taxTotal: true },
      _count: { id: true },
    }),
    prisma.document.aggregate({
      where: {
        companyId,
        documentType: 'PURCHASE',
        status: 'POSTED',
      },
      _sum: { grandTotal: true, taxTotal: true },
      _count: { id: true },
    }),
    prisma.document.findMany({
      where: {
        companyId,
        documentType: { in: ['SALE', 'POS', 'EXPORT_INVOICE'] },
        status: 'POSTED',
      },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        documentDate: true,
        billingPartyName: true,
        grandTotal: true,
        status: true,
        party: { select: { id: true, name: true } },
      },
      orderBy: { documentDate: 'desc' },
      take: 8,
    }),
    prisma.party.findMany({
      where: { companyId },
      select: {
        id: true,
        openingBalance: true,
        openingBalanceType: true,
        ledgerEntries: { select: { debit: true, credit: true } },
      },
    }),
    prisma.item.findMany({
      where: { companyId, isService: false },
      select: {
        id: true,
        name: true,
        sku: true,
        openingStock: true,
        purchasePrice: true,
        minStockLevel: true,
        stockMovements: { select: { quantity: true, movementType: true } },
      },
    }),
  ]);

  const totalSalesRevenue = new Decimal(salesAgg._sum.grandTotal || 0);
  const totalTaxCollected = new Decimal(salesAgg._sum.taxTotal || 0);
  const totalSalesCount = salesAgg._count.id || 0;

  const totalPurchases = new Decimal(purchaseAgg._sum.grandTotal || 0);
  const totalInputTax = new Decimal(purchaseAgg._sum.taxTotal || 0);
  const totalPurchaseCount = purchaseAgg._count.id || 0;

  let totalReceivable = new Decimal(0);
  let totalPayable = new Decimal(0);

  for (const p of parties) {
    let bal = new Decimal(p.openingBalanceType === 'DEBIT' ? p.openingBalance : p.openingBalance.negated());
    for (const le of p.ledgerEntries) {
      bal = bal.plus(new Decimal(le.debit)).minus(new Decimal(le.credit));
    }
    if (bal.greaterThan(0)) {
      totalReceivable = totalReceivable.plus(bal);
    } else if (bal.lessThan(0)) {
      totalPayable = totalPayable.plus(bal.abs());
    }
  }

  // 4. Stock & Low Stock Items Calculation
  let totalStockValuation = new Decimal(0);
  let lowStockCount = 0;
  const lowStockItems: any[] = [];

  for (const it of items) {
    let currentStock = new Decimal(it.openingStock);
    for (const sm of it.stockMovements) {
      const q = new Decimal(sm.quantity);
      if (['PURCHASE_IN', 'SALE_RETURN_IN', 'ADJUSTMENT_IN'].includes(sm.movementType)) {
        currentStock = currentStock.plus(q);
      } else {
        currentStock = currentStock.minus(q);
      }
    }
    const val = currentStock.times(new Decimal(it.purchasePrice));
    totalStockValuation = totalStockValuation.plus(val);

    if (currentStock.lessThanOrEqualTo(new Decimal(it.minStockLevel))) {
      lowStockCount++;
      if (lowStockItems.length < 5) {
        lowStockItems.push({
          id: it.id,
          name: it.name,
          sku: it.sku,
          currentStock: currentStock.toNumber(),
          minStock: new Decimal(it.minStockLevel).toNumber(),
        });
      }
    }
  }

  const canInvoicing = hasFeature(authContext, 'INVOICING');
  const canPurchases = hasFeature(authContext, 'PURCHASES');
  const canInventory = hasFeature(authContext, 'INVENTORY');
  const canItems = hasFeature(authContext, 'ITEMS');
  const canParties = hasFeature(authContext, 'PARTY_BALANCE');
  const canGst = hasFeature(authContext, 'GST_REPORTS');

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Executive Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live financial overview for <strong>{authContext.company.name}</strong> • FY {authContext.financialYear?.name}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canInvoicing && (
              <Link
                href="/sales/invoices/new"
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" /> + New Tax Invoice
              </Link>
            )}
            {hasFeature(authContext, 'POS') && (
              <Link
                href="/sales/pos"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                Retail POS Counter
              </Link>
            )}
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Sales */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Sales (FY)</span>
              <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {formatCurrency(totalSalesRevenue)}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="font-semibold text-slate-700">{totalSalesCount}</span> Invoices & Bills
            </div>
          </div>

          {/* Receivables */}
          {canParties && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Receivables (Due)</span>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-600">
                {formatCurrency(totalReceivable)}
              </div>
              <div className="text-xs text-slate-500 mt-1">From active customers</div>
            </div>
          )}

          {/* Payables */}
          {canPurchases && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Payables (Due)</span>
                <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                  <ArrowDownLeft className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-rose-600">
                {formatCurrency(totalPayable)}
              </div>
              <div className="text-xs text-slate-500 mt-1">To vendor suppliers</div>
            </div>
          )}

          {/* Stock Valuation */}
          {canInventory && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Inventory Value</span>
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Package className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {formatCurrency(totalStockValuation)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {items.length} Products in catalog
              </div>
            </div>
          )}
        </div>

        {/* GST Tax Breakdown Widget */}
        {canGst && (
          <div className="bg-gradient-to-r from-sky-900 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-sky-400" /> GST Tax Position (Live)
                </h3>
                <p className="text-xs text-slate-300">
                  Output GST Liability vs Input Tax Credit (ITC)
                </p>
              </div>
              <Link
                href="/reports/gst"
                className="text-xs bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-semibold px-3 py-1.5 rounded-lg border border-sky-400/30 transition w-fit"
              >
                View HSN & Tax Registers →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Output GST (Liability)
                </div>
                <div className="text-xl font-black text-sky-400 mt-0.5">
                  {formatCurrency(totalTaxCollected)}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Input GST (ITC Claimable)
                </div>
                <div className="text-xl font-black text-emerald-400 mt-0.5">
                  {formatCurrency(totalInputTax)}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Net Tax Payable
                </div>
                <div className="text-xl font-black text-amber-300 mt-0.5">
                  {formatCurrency(Decimal.max(0, totalTaxCollected.minus(totalInputTax)))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Grid: Recent Transactions & Low Stock Alerts */}
        <div className={cn("grid grid-cols-1 gap-6", canInventory ? "lg:grid-cols-3" : "lg:grid-cols-1")}>
          {/* Recent Invoices Table */}
          <div className={cn("bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col", canInventory ? "lg:col-span-2" : "lg:col-span-1")}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Recent Sales & POS Invoices</h3>
              <Link
                href="/sales/invoices"
                className="text-xs font-semibold text-sky-600 hover:text-sky-700"
              >
                View All ({totalSalesCount}) →
              </Link>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Doc #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Party Name</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTransactions.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {doc.documentNumber}
                      </td>
                      <td className="p-3 text-slate-600">{formatDate(doc.documentDate)}</td>
                      <td className="p-3 font-medium text-slate-800">
                        {doc.billingPartyName || doc.party?.name || 'Walk-in Customer'}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        {formatCurrency(doc.grandTotal)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {doc.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Link
                          href={`/sales/invoices/${doc.id}`}
                          className="text-sky-600 hover:text-sky-800 font-semibold"
                        >
                          View / Print
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low Stock Alerts (1 Col) */}
          {canInventory && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <div className="flex items-center gap-1.5 text-amber-600 font-bold text-sm">
                  <AlertTriangle className="h-4 w-4" /> Low Stock Alerts
                </div>
                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  {lowStockCount} Items
                </span>
              </div>

              {lowStockItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <Package className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-xs">All inventory items are well stocked!</p>
                </div>
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">{item.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">SKU: {item.sku}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-rose-600">
                          {item.currentStock} left
                        </div>
                        <div className="text-[10px] text-slate-500">Min: {item.minStock}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 mt-auto">
                <Link
                  href="/inventory/items"
                  className="block text-center text-xs font-semibold text-sky-600 hover:text-sky-700"
                >
                  Manage Inventory & Stock →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

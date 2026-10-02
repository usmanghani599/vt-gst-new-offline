import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { LedgerService } from '@/lib/services/ledger-service';
import { formatCurrency, formatDate } from '@/lib/utils';
import Decimal from 'decimal.js';
import Link from 'next/link';
import {
  Receipt,
  Calendar,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  CreditCard,
  Building,
  AlertCircle,
  Clock,
  Printer,
} from 'lucide-react';

interface DayBookProps {
  searchParams: Promise<{
    date?: string;
    fromDate?: string;
    toDate?: string;
    filterType?: string;
  }>;
}

export default async function DayBookPage({ searchParams }: DayBookProps) {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;
  const resolvedSearchParams = await searchParams;
  const fromDate = resolvedSearchParams?.fromDate;
  const toDate = resolvedSearchParams?.toDate;
  const date = resolvedSearchParams?.date;
  const filterType = resolvedSearchParams?.filterType || 'ALL';

  // Determine current active date or range
  const todayStr = new Date().toISOString().split('T')[0];
  const queryOptions = fromDate || toDate
    ? { fromDate, toDate, filterType }
    : date
    ? { date, filterType }
    : { date: todayStr, filterType };

  const result = await LedgerService.getDayBook(companyId, queryOptions);
  const entries = result.entries;
  const isFallback = result.isFallback;

  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);
  let cashInflow = new Decimal(0);
  let cashOutflow = new Decimal(0);

  for (const e of entries) {
    const d = new Decimal(e.debit);
    const c = new Decimal(e.credit);
    totalDebits = totalDebits.plus(d);
    totalCredits = totalCredits.plus(c);

    if (e.accountHead === 'BANK_OR_CASH') {
      cashInflow = cashInflow.plus(c); // Payments received
      cashOutflow = cashOutflow.plus(d); // Payments made
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Receipt className="h-6 w-6 text-sky-600" /> Day Book & Cash Journal
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
                {entries.length} Entries
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological double-entry audit log of all sales, receipts, payments, purchases, and cash flows
            </p>
          </div>

          <div className="flex items-center gap-2 no-print">
            <Link
              href="/reports/sales"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition"
            >
              Sales Register
            </Link>
            <Link
              href="/parties/ledger"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition"
            >
              Party Ledgers
            </Link>
          </div>
        </div>

        {/* Fallback Notice */}
        {isFallback && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">No entries found specifically for {todayStr}.</strong>
                <p className="text-amber-800 mt-0.5">
                  Showing the <strong>most recent transactions</strong> from your journal below. You can select any custom date range using the filters.
                </p>
              </div>
            </div>
            <Link
              href="/reports/day-book?fromDate=2024-04-01"
              className="shrink-0 bg-amber-200 hover:bg-amber-300 text-amber-900 px-3 py-1.5 rounded-lg font-bold text-xs transition"
            >
              View All Entries
            </Link>
          </div>
        )}

        {/* Filter Bar & Quick Presets */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 no-print">
          <form method="GET" className="flex flex-wrap items-end gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                From Date
              </label>
              <input
                type="date"
                name="fromDate"
                defaultValue={fromDate || (date ? date : '')}
                className="px-3 py-2 border border-slate-300 rounded-lg font-semibold text-xs focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                To Date
              </label>
              <input
                type="date"
                name="toDate"
                defaultValue={toDate || (date ? date : '')}
                className="px-3 py-2 border border-slate-300 rounded-lg font-semibold text-xs focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Account Head / Filter
              </label>
              <select
                name="filterType"
                defaultValue={filterType}
                className="px-3 py-2 border border-slate-300 rounded-lg font-semibold text-xs focus:ring-2 focus:ring-sky-500 bg-slate-50"
              >
                <option value="ALL">All Journal Entries</option>
                <option value="CASH_BANK">Cash & Bank Only (Cash Book)</option>
                <option value="RECEIVABLES">Accounts Receivable (Sales)</option>
                <option value="PAYABLES">Accounts Payable (Purchases)</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
            >
              <Filter className="h-3.5 w-3.5" /> Filter Day Book
            </button>
          </form>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Quick Ranges:
            </span>
            <Link
              href={`/reports/day-book?date=${todayStr}`}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 font-semibold transition text-[11px]"
            >
              Today
            </Link>
            <Link
              href="/reports/day-book?fromDate=2026-09-01&toDate=2026-09-30"
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 font-semibold transition text-[11px]"
            >
              This Month
            </Link>
            <Link
              href="/reports/day-book?filterType=CASH_BANK"
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-semibold transition text-[11px]"
            >
              Cash & Bank Journal
            </Link>
            <Link
              href="/reports/day-book?fromDate=2024-04-01"
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-semibold transition text-[11px]"
            >
              Full Financial Year
            </Link>
          </div>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Debits (Dr)</span>
              <ArrowDownRight className="h-4 w-4 text-sky-500" />
            </div>
            <div className="text-xl font-black text-slate-900">{formatCurrency(totalDebits)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Total journal debits</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Credits (Cr)</span>
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black text-emerald-700">{formatCurrency(totalCredits)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Total journal credits</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cash / Bank Inflow</span>
              <CreditCard className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-xl font-black text-indigo-700">{formatCurrency(cashInflow)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Receipts & Cash Sales</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cash / Bank Outflow</span>
              <Building className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-xl font-black text-amber-700">{formatCurrency(cashOutflow)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Payments & Expenses</div>
          </div>
        </div>

        {/* Journal Entries Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Account Head</th>
                <th className="p-3.5">Party / Customer</th>
                <th className="p-3.5">Reference Document / Receipt</th>
                <th className="p-3.5 text-right">Debit (Dr ₹)</th>
                <th className="p-3.5 text-right">Credit (Cr ₹)</th>
                <th className="p-3.5">Narration / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-600">No Journal Entries Recorded</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try selecting a broader date range or create a sale or POS bill.
                    </p>
                  </td>
                </tr>
              ) : (
                entries.map((e) => {
                  const isDebit = Number(e.debit) > 0;
                  const isCredit = Number(e.credit) > 0;

                  return (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                        {formatDate(e.entryDate)}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            e.accountHead === 'BANK_OR_CASH'
                              ? 'bg-emerald-100 text-emerald-800'
                              : e.accountHead === 'ACCOUNTS_RECEIVABLE'
                              ? 'bg-sky-100 text-sky-800'
                              : e.accountHead === 'ACCOUNTS_PAYABLE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {e.accountHead}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {e.party ? (
                          <Link
                            href={`/parties/ledger?partyId=${e.party.id}`}
                            className="hover:underline text-slate-900"
                          >
                            {e.party.name}
                          </Link>
                        ) : (
                          <span className="text-slate-500">Walk-in Customer / Direct</span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-sky-700 font-bold">
                        {e.document ? (
                          <Link
                            href={`/sales/invoices/${e.document.id}`}
                            className="hover:underline flex items-center gap-1"
                          >
                            <FileText className="h-3 w-3" />
                            {e.document.documentNumber}
                          </Link>
                        ) : e.payment ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CreditCard className="h-3 w-3" />
                            {e.payment.paymentNumber}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3.5 text-right font-black text-slate-900">
                        {isDebit ? formatCurrency(e.debit) : '-'}
                      </td>
                      <td className="p-3.5 text-right font-black text-emerald-700">
                        {isCredit ? formatCurrency(e.credit) : '-'}
                      </td>
                      <td className="p-3.5 text-slate-600 max-w-xs truncate">
                        {e.narration || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

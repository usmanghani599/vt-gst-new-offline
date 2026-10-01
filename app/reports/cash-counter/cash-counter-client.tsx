'use client';

import React, { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Banknote,
  QrCode,
  CreditCard,
  UserCheck,
  Printer,
  Search,
  Filter,
  ArrowDownRight,
  TrendingUp,
  Receipt,
  Store,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  Building,
} from 'lucide-react';
import Link from 'next/link';

interface TransactionItem {
  id: string;
  docNumber: string;
  docType: string;
  date: string;
  customerName: string;
  paymentMode: string;
  amount: number;
}

interface CashierCollection {
  id: string;
  name: string;
  code: string;
  isDirectCounter: boolean;
  totalCash: number;
  totalUpi: number;
  totalCard: number;
  totalOther: number;
  totalCollected: number;
  billCount: number;
  transactions: TransactionItem[];
}

interface CashCounterClientProps {
  collections: CashierCollection[];
  selectedDate: string;
  fromDate?: string;
  toDate?: string;
}

export function CashCounterClient({
  collections,
  selectedDate,
  fromDate,
  toDate,
}: CashCounterClientProps) {
  const [selectedCashier, setSelectedCashier] = useState<CashierCollection | null>(null);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'DETAILED'>('SUMMARY');

  const grandTotalCash = collections.reduce((acc, c) => acc + c.totalCash, 0);
  const grandTotalUpi = collections.reduce((acc, c) => acc + c.totalUpi, 0);
  const grandTotalCard = collections.reduce((acc, c) => acc + c.totalCard, 0);
  const grandTotalAll = collections.reduce((acc, c) => acc + c.totalCollected, 0);
  const grandTotalBills = collections.reduce((acc, c) => acc + c.billCount, 0);

  function handlePrintShiftSlip(cashier: CashierCollection) {
    setSelectedCashier(cashier);
    setTimeout(() => {
      window.print();
    }, 200);
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Banknote className="h-6 w-6 text-emerald-600" /> Cash Counter & Shift Handover Report
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              User-wise Collections
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit physical cash collected per cashier/salesman to collect cash from counter drawers at shift end
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/sales/pos"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
          >
            <Store className="h-4 w-4" /> POS Counter
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4" /> Print Full Summary
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 no-print">
        <form method="GET" className="flex flex-wrap items-end gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              From Date
            </label>
            <input
              type="date"
              name="fromDate"
              defaultValue={fromDate || selectedDate}
              className="px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              To Date
            </label>
            <input
              type="date"
              name="toDate"
              defaultValue={toDate || selectedDate}
              className="px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
          >
            <Filter className="h-3.5 w-3.5" /> Filter Collections
          </button>
        </form>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Quick Ranges:
          </span>
          <Link
            href={`/reports/cash-counter?date=${new Date().toISOString().split('T')[0]}`}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-semibold transition text-[11px]"
          >
            Today
          </Link>
          <Link
            href="/reports/cash-counter?fromDate=2026-09-01&toDate=2026-09-30"
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-semibold transition text-[11px]"
          >
            This Month
          </Link>
          <Link
            href="/reports/cash-counter?fromDate=2024-04-01"
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-semibold transition text-[11px]"
          >
            Full Financial Year
          </Link>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Physical Cash to Collect */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-md space-y-2">
          <div className="flex items-center justify-between opacity-90">
            <span className="text-xs font-bold uppercase tracking-wider">Physical Cash in Hand</span>
            <div className="p-2 bg-white/20 rounded-xl">
              <Banknote className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="text-3xl font-black tracking-tight">{formatCurrency(grandTotalCash)}</div>
          <p className="text-[11px] text-emerald-100 font-medium">
            Cash to collect from counter drawers & cashiers
          </p>
        </div>

        {/* UPI / QR Collections */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">UPI / QR Digital</span>
            <div className="p-2 bg-sky-50 rounded-xl text-sky-600">
              <QrCode className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{formatCurrency(grandTotalUpi)}</div>
          <p className="text-[11px] text-slate-500 font-medium">Direct bank settlement via UPI</p>
        </div>

        {/* Card Swipes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Card Swipes (POS)</span>
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{formatCurrency(grandTotalCard)}</div>
          <p className="text-[11px] text-slate-500 font-medium">Credit / Debit card EDC machine</p>
        </div>

        {/* Overall Collection */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Sales Turnover</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{formatCurrency(grandTotalAll)}</div>
          <p className="text-[11px] text-slate-500 font-medium">Across {grandTotalBills} settled bills</p>
        </div>
      </div>

      {/* Staff / Cashier Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between no-print">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-sky-600" />
            User / Salesman Wise Cash Breakdown ({collections.length} Counters/Staff)
          </h2>
        </div>

        {collections.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
            <Banknote className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-800">No Counter Collections Found</h3>
            <p className="text-xs text-slate-400 mt-1">
              No cash or digital payments were recorded for the selected date range.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {collections.map((cashier) => (
              <div
                key={cashier.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-emerald-300 transition flex flex-col justify-between"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between border-b pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{cashier.name}</h3>
                      <div className="text-xs font-mono text-slate-500">
                        Code: {cashier.code || 'MAIN-01'}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700">
                      {cashier.billCount} Bills
                    </span>
                  </div>

                  {/* Cash to collect callout */}
                  <div className="mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                    <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
                      <span>Cash In Hand to Collect:</span>
                      <Banknote className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-black text-emerald-900">
                      {formatCurrency(cashier.totalCash)}
                    </div>
                    <div className="text-[10px] text-emerald-700">
                      Must be handed over to store manager / safe
                    </div>
                  </div>

                  {/* Payment Mode Breakdown */}
                  <div className="mt-3 space-y-1.5 text-xs text-slate-600 pt-2">
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        <QrCode className="h-3.5 w-3.5 text-sky-500" /> UPI / QR:
                      </span>
                      <strong className="text-slate-800">{formatCurrency(cashier.totalUpi)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5 text-indigo-500" /> Card Swipes:
                      </span>
                      <strong className="text-slate-800">{formatCurrency(cashier.totalCard)}</strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t font-bold text-slate-900">
                      <span>Total Revenue:</span>
                      <span>{formatCurrency(cashier.totalCollected)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t flex items-center justify-between gap-2 no-print">
                  <button
                    type="button"
                    onClick={() => setSelectedCashier(cashier)}
                    className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition text-center"
                  >
                    View {cashier.transactions.length} Transactions
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintShiftSlip(cashier)}
                    className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                    title="Print Shift Handover Slip"
                  >
                    <Printer className="h-3.5 w-3.5" /> Handover Slip
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction Details Modal & Printable Handover Slip */}
      {selectedCashier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col print:p-0 print:border-none print:shadow-none">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-emerald-600" />
                  Cash Counter Handover Slip: {selectedCashier.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Employee Code: {selectedCashier.code || 'N/A'} • Period: {fromDate || selectedDate} to {toDate || selectedDate}
                </p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Handover Slip
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCashier(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Shift Handover Summary Box */}
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs shrink-0">
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                  💵 Physical Cash to Handover
                </span>
                <strong className="text-lg font-black text-emerald-700 block mt-0.5">
                  {formatCurrency(selectedCashier.totalCash)}
                </strong>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  📱 UPI / Card Digital
                </span>
                <strong className="text-lg font-black text-slate-800 block mt-0.5">
                  {formatCurrency(selectedCashier.totalUpi + selectedCashier.totalCard)}
                </strong>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  🧾 Total Invoices Cut
                </span>
                <strong className="text-lg font-black text-slate-800 block mt-0.5">
                  {selectedCashier.billCount} Bills
                </strong>
              </div>
            </div>

            {/* Transactions List */}
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Settled Invoices & Receipts:
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b text-[10px] uppercase">
                  <tr>
                    <th className="p-2">Doc #</th>
                    <th className="p-2">Time / Date</th>
                    <th className="p-2">Customer</th>
                    <th className="p-2 text-center">Payment Mode</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedCashier.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono font-bold text-sky-700">
                        {tx.docNumber}
                      </td>
                      <td className="p-2 text-slate-500">{formatDate(tx.date)}</td>
                      <td className="p-2 font-medium text-slate-800">{tx.customerName}</td>
                      <td className="p-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.paymentMode === 'CASH'
                              ? 'bg-emerald-100 text-emerald-800'
                              : tx.paymentMode === 'UPI'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {tx.paymentMode}
                        </span>
                      </td>
                      <td className="p-2 text-right font-black text-slate-900">
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Handover Signatures (Visible for Printing) */}
            <div className="pt-4 border-t border-slate-300 grid grid-cols-2 gap-6 text-xs shrink-0">
              <div className="space-y-4">
                <div className="h-10 border-b border-dashed border-slate-400"></div>
                <div className="font-bold text-slate-700">
                  Cashier / Staff Signature ({selectedCashier.name})
                </div>
              </div>
              <div className="space-y-4 text-right">
                <div className="h-10 border-b border-dashed border-slate-400"></div>
                <div className="font-bold text-slate-700">
                  Manager / Receiver Signature (Cash Collected)
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end no-print shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCashier(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Close Handover Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

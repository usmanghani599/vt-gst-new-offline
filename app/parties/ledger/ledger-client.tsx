'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Calendar,
  ArrowLeft,
  Search,
  Filter,
  Download,
  Printer,
  TrendingUp,
  CreditCard,
  Plus,
  Image as ImageIcon,
  ExternalLink,
  Eye,
  X,
  FileText,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PaymentModal } from '../payments/payment-modal';

interface PartyLedgerClientProps {
  parties: any[];
  bankAccounts: any[];
  selectedPartyId: string;
  ledgerData: any;
  fromDate?: string;
  toDate?: string;
}

export function PartyLedgerClient({
  parties,
  bankAccounts,
  selectedPartyId,
  ledgerData,
  fromDate = '',
  toDate = '',
}: PartyLedgerClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filterParty, setFilterParty] = useState(selectedPartyId);
  const [filterFromDate, setFilterFromDate] = useState(fromDate);
  const [filterToDate, setFilterToDate] = useState(toDate);
  const [activeTypeFilter, setActiveTypeFilter] = useState<'ALL' | 'INVOICES' | 'PAYMENTS'>('ALL');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  const party = ledgerData?.party;
  const entries: any[] = ledgerData?.entries || [];

  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams();
    if (filterParty) params.set('partyId', filterParty);
    if (filterFromDate) params.set('fromDate', filterFromDate);
    if (filterToDate) params.set('toDate', filterToDate);
    router.push(`/parties/ledger?${params.toString()}`);
  };

  const setDatePreset = (preset: 'TODAY' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_FY' | 'ALL') => {
    const now = new Date();
    let from = '';
    let to = '';

    if (preset === 'TODAY') {
      from = now.toISOString().split('T')[0];
      to = from;
    } else if (preset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      from = start.toISOString().split('T')[0];
      to = now.toISOString().split('T')[0];
    } else if (preset === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      from = start.toISOString().split('T')[0];
      to = end.toISOString().split('T')[0];
    } else if (preset === 'THIS_FY') {
      const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      from = `${year}-04-01`;
      to = `${year + 1}-03-31`;
    } else if (preset === 'ALL') {
      from = '';
      to = '';
    }

    setFilterFromDate(from);
    setFilterToDate(to);

    const params = new URLSearchParams();
    if (filterParty) params.set('partyId', filterParty);
    if (from) params.set('fromDate', from);
    if (to) params.set('toDate', to);
    router.push(`/parties/ledger?${params.toString()}`);
  };

  // Calculations for summary cards
  const totalDebits = entries.reduce((acc, it) => acc + (it.debit || 0), 0);
  const totalCredits = entries.reduce((acc, it) => acc + (it.credit || 0), 0);
  const finalBalance = ledgerData?.finalBalance || 0;

  // Filtered entries by type tab
  const filteredEntries = entries.filter((e) => {
    if (activeTypeFilter === 'INVOICES') {
      return ['SALE', 'POS', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(e.documentType);
    }
    if (activeTypeFilter === 'PAYMENTS') {
      return ['PAYMENT', 'RECEIPT'].includes(e.documentType);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/parties/customers"
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Party Account Ledger</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time statement of account, in/out payment vouchers, attachments, and running balance
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Record In/Out Button */}
          <PaymentModal
            parties={parties}
            bankAccounts={bankAccounts}
            defaultPartyId={selectedPartyId}
            buttonLabel="Record IN / OUT Payment"
            buttonClassName="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition inline-flex items-center gap-2 cursor-pointer"
          />

          <button
            onClick={() => window.print()}
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print Statement
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <form onSubmit={handleApplyFilter} className="flex flex-col md:flex-row items-end gap-3">
          {/* Party Dropdown */}
          <div className="flex-1 min-w-[240px] w-full">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Select Party / Customer
            </label>
            <select
              value={filterParty}
              onChange={(e) => setFilterParty(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.gstin ? `(${p.gstin})` : ''} {p.mobile ? `- ${p.mobile}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div className="w-full sm:w-auto">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 bg-slate-50 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* To Date */}
          <div className="w-full sm:w-auto">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 bg-slate-50 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Filter button */}
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Apply Filter
          </button>
        </form>

        {/* Date Preset Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 text-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Quick Ranges:</span>
          {[
            { key: 'TODAY', label: 'Today' },
            { key: 'THIS_MONTH', label: 'This Month' },
            { key: 'LAST_MONTH', label: 'Last Month' },
            { key: 'THIS_FY', label: 'This Financial Year' },
            { key: 'ALL', label: 'All Time' },
          ].map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => setDatePreset(preset.key as any)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition whitespace-nowrap cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Party Summary & Balance Stats */}
      {party && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Party Details */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Party Information
            </span>
            <h3 className="text-base font-black text-slate-900 mt-1">{party.name}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              GSTIN: {party.gstin || 'Unregistered'}
            </p>
          </div>

          {/* Total Debits */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Invoiced / Debits (+)
            </span>
            <div className="text-xl font-black text-slate-900 mt-1">
              ₹{totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Sales invoices & debit adjustments</p>
          </div>

          {/* Total Credits */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Received / Credits (-)
            </span>
            <div className="text-xl font-black text-emerald-600 mt-1">
              ₹{totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Inbound receipts & disbursements</p>
          </div>

          {/* Current Balance */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Closing Running Balance
            </span>
            <div
              className={`text-xl font-black mt-1 ${
                finalBalance > 0 ? 'text-amber-600' : finalBalance < 0 ? 'text-emerald-600' : 'text-slate-900'
              }`}
            >
              ₹{Math.abs(finalBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span
              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1 ${
                finalBalance > 0
                  ? 'bg-amber-100 text-amber-800'
                  : finalBalance < 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {finalBalance > 0 ? 'Receivable (Party Owes)' : finalBalance < 0 ? 'Advance / Payable' : 'Clear'}
            </span>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Type Tabs */}
        <div className="flex border-b border-slate-200 px-4 pt-3 gap-3 text-xs font-bold">
          <button
            onClick={() => setActiveTypeFilter('ALL')}
            className={`pb-3 border-b-2 transition cursor-pointer ${
              activeTypeFilter === 'ALL'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            All Ledger Transactions ({entries.length})
          </button>
          <button
            onClick={() => setActiveTypeFilter('INVOICES')}
            className={`pb-3 border-b-2 transition cursor-pointer ${
              activeTypeFilter === 'INVOICES'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Invoices & Sales Only
          </button>
          <button
            onClick={() => setActiveTypeFilter('PAYMENTS')}
            className={`pb-3 border-b-2 transition cursor-pointer ${
              activeTypeFilter === 'PAYMENTS'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Money IN / OUT Payments Only
          </button>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto opacity-40 mb-2" />
            <p className="font-semibold text-slate-600 text-sm">No transactions found for this period</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting the date range or record a new transaction
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Voucher / Document #</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Mode & Reference</th>
                  <th className="py-3 px-3">Narration / Notes</th>
                  <th className="py-3 px-2 text-center">Proof / Slip</th>
                  <th className="py-3 px-3 text-right">Debit (+)</th>
                  <th className="py-3 px-3 text-right">Credit (-)</th>
                  <th className="py-3 px-3 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredEntries.map((item) => {
                  const typeColors: any = {
                    SALE: 'bg-blue-50 text-blue-700 border-blue-200',
                    POS: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                    RECEIPT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    PAYMENT: 'bg-rose-50 text-rose-700 border-rose-200',
                    CREDIT_NOTE: 'bg-amber-50 text-amber-700 border-amber-200',
                    DEBIT_NOTE: 'bg-purple-50 text-purple-700 border-purple-200',
                  };

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 text-slate-600 font-mono whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {item.documentNumber}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                            typeColors[item.documentType] || 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {item.documentType}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        {item.paymentMode ? (
                          <div>
                            <span className="font-semibold text-slate-800 block text-[11px]">
                              {item.paymentMode}
                            </span>
                            {item.referenceNumber && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {item.referenceNumber}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-slate-700 max-w-xs">
                        {item.narration || '-'}
                      </td>

                      {/* Photo Proof / Slip preview */}
                      <td className="py-3 px-2 text-center">
                        {item.attachmentUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedPhotoUrl(item.attachmentUrl)}
                            className="inline-flex items-center gap-1 p-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold transition cursor-pointer"
                            title="View Attached Slip"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {item.debit > 0
                          ? `₹${item.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-emerald-600">
                        {item.credit > 0
                          ? `₹${item.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>

                      <td className="py-3 px-3 text-right font-black text-sm text-slate-900">
                        ₹{item.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Photo Attachment Modal Viewer */}
      {selectedPhotoUrl && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-4 space-y-3 shadow-2xl relative">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-bold text-slate-900">Payment Attachment / Slip</span>
              <button
                type="button"
                onClick={() => setSelectedPhotoUrl(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-950 rounded-2xl p-2">
              <img
                src={selectedPhotoUrl}
                alt="Payment proof"
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PaymentModal } from './payment-modal';
import { CreditCard, Image as ImageIcon } from 'lucide-react';

export default async function PaymentsPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;

  const [payments, parties, bankAccounts] = await Promise.all([
    prisma.payment.findMany({
      where: { companyId },
      include: { party: true, bankAccount: true },
      orderBy: { paymentDate: 'desc' },
    }),
    prisma.party.findMany({
      where: { companyId, isWalkIn: false },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
    }),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payments & Receipts Register</h1>
            <p className="text-xs text-slate-500">
              Track customer inbound receipts (Money IN), supplier disbursements (Money OUT), bank slips, and cheque records
            </p>
          </div>

          <PaymentModal parties={parties} bankAccounts={bankAccounts} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Payment #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Party Name</th>
                  <th className="p-3.5">Payment Mode</th>
                  <th className="p-3.5">Bank / Ref / Cheque #</th>
                  <th className="p-3.5 text-center">Proof / Slip</th>
                  <th className="p-3.5 text-right">Amount (₹)</th>
                  <th className="p-3.5">Narration / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400">
                      <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-slate-600">No Payments Recorded Yet</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Use the "Record Payment / Receipt" button to record transactions
                      </p>
                    </td>
                  </tr>
                ) : (
                  payments.map((pm) => (
                    <tr key={pm.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-mono font-bold text-sky-700">{pm.paymentNumber}</td>
                      <td className="p-3.5 text-slate-600 whitespace-nowrap">{formatDate(pm.paymentDate)}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            pm.paymentType === 'IN_RECEIPT'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {pm.paymentType === 'IN_RECEIPT' ? 'Money IN (Receipt)' : 'Money OUT (Payment)'}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">{pm.party.name}</td>
                      <td className="p-3.5 font-semibold text-slate-700">{pm.paymentMode}</td>
                      <td className="p-3.5 font-mono text-slate-500">
                        {pm.bankAccount?.bankName || pm.chequeNumber || pm.referenceNumber || '-'}
                      </td>
                      <td className="p-3.5 text-center">
                        {pm.attachmentUrl ? (
                          <a
                            href={pm.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Slip</span>
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-black text-sm">
                        <span className={pm.paymentType === 'IN_RECEIPT' ? 'text-emerald-700' : 'text-rose-600'}>
                          {formatCurrency(pm.amount)}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600 max-w-xs truncate">{pm.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

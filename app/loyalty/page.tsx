import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import { Award, Users } from 'lucide-react';

export default async function LoyaltyPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const accounts = await prisma.loyaltyAccount.findMany({
    where: { party: { companyId: authContext.company.id } },
    include: { party: true, transactions: true },
    orderBy: { currentPoints: 'desc' },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customer Loyalty Program</h1>
          <p className="text-xs text-slate-500">
            Reward repeat buyers with loyalty points on retail sales and redemption during checkout
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5">Phone / Contact</th>
                <th className="p-3.5 text-right">Total Points Earned</th>
                <th className="p-3.5 text-right">Points Redeemed</th>
                <th className="p-3.5 text-right">Available Points</th>
                <th className="p-3.5 text-right">Cashback Value (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    <Award className="h-8 w-8 mx-auto mb-2 opacity-50 text-amber-500" />
                    <p className="font-semibold text-slate-600">Loyalty program active on retail counter</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Points will accrue automatically as customers purchase at POS.</p>
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-bold text-slate-900">{acc.party.name}</td>
                    <td className="p-3.5 text-slate-600">{acc.party.phone || acc.party.mobile || '-'}</td>
                    <td className="p-3.5 text-right font-medium text-slate-700">{formatQuantity(acc.totalEarned)}</td>
                    <td className="p-3.5 text-right font-medium text-rose-600">-{formatQuantity(acc.totalRedeemed)}</td>
                    <td className="p-3.5 text-right font-black text-amber-600 text-sm">{formatQuantity(acc.currentPoints)}</td>
                    <td className="p-3.5 text-right font-black text-slate-900">{formatCurrency(acc.currentPoints)}</td>
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

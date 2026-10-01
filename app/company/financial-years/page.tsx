import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { formatDate } from '@/lib/utils';
import { RolloverWizard } from './rollover-wizard';
import { Calendar, Lock, CheckCircle2 } from 'lucide-react';

export default async function FinancialYearsPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const companyId = authContext.company.id;

  const [financialYears, closingSnapshots] = await Promise.all([
    prisma.financialYear.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { documents: true, ledgerEntries: true, stockMovements: true },
        },
      },
      orderBy: { startDate: 'desc' },
    }),
    prisma.financialYearClosing.findMany({
      where: { financialYear: { companyId } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const activeFy = authContext.financialYear;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Financial Years & Rollover</h1>
            <p className="text-xs text-slate-500">
              Manage accounting periods, audit closing snapshots, and perform 1-Click fiscal year rollover
            </p>
          </div>

          {activeFy && !activeFy.isClosed && (
            <RolloverWizard currentFy={activeFy} />
          )}
        </div>

        {/* Current Active FY Info Banner */}
        {activeFy && (
          <div className="bg-sky-50 border border-sky-200 p-5 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-sky-600 text-white rounded-xl shadow-md shadow-sky-600/20">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Current Active Accounting Period: FY {activeFy.name}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  From {formatDate(activeFy.startDate)} to {formatDate(activeFy.endDate)} •{' '}
                  {activeFy.isClosed ? (
                    <strong className="text-red-600">CLOSED & LOCKED (Read-Only)</strong>
                  ) : (
                    <strong className="text-emerald-700">OPEN FOR TRANSACTIONS</strong>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Financial Years Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Financial Year</th>
                <th className="p-3.5">Start Date</th>
                <th className="p-3.5">End Date</th>
                <th className="p-3.5 text-center">Transactions Bound</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Closed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {financialYears.map((fy) => (
                <tr key={fy.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3.5 font-bold text-slate-900 text-sm">FY {fy.name}</td>
                  <td className="p-3.5 text-slate-600">{formatDate(fy.startDate)}</td>
                  <td className="p-3.5 text-slate-600">{formatDate(fy.endDate)}</td>
                  <td className="p-3.5 text-center font-semibold text-slate-700">
                    {fy._count.documents} Docs | {fy._count.ledgerEntries} Ledgers
                  </td>
                  <td className="p-3.5 text-center">
                    {fy.isClosed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                        <Lock className="h-3 w-3" /> Closed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" /> Active / Open
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-center text-slate-500 font-mono">
                    {fy.closedAt ? formatDate(fy.closedAt) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { LedgerService } from '@/lib/services/ledger-service';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Plus, Users, ArrowRight, Phone, MapPin } from 'lucide-react';
import { PartyActions } from '../party-actions';

export default async function SuppliersPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const suppliers = await LedgerService.getPartyBalances(authContext.company.id, 'SUPPLIER');

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Vendor & Supplier Directory</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage vendor accounts, GSTIN verification, and outstanding payables
            </p>
          </div>
          <Link
            href="/parties/new?type=SUPPLIER"
            className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition inline-flex items-center gap-1.5 w-fit"
          >
            <Plus className="h-4 w-4" /> Add Supplier
          </Link>
        </div>

        {/* Mobile View: Supplier Cards */}
        <div className="md:hidden space-y-3">
          {suppliers.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-slate-600 text-xs">No Suppliers Found</p>
            </div>
          ) : (
            suppliers.map((s) => (
              <div
                key={s.id}
                className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">{s.name}</h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      GSTIN: {s.gstin || 'Unregistered'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-base font-black ${s.balance > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {formatCurrency(s.balance)}
                    </div>
                    <span className={`inline-block px-2 py-0.2 rounded text-[9px] font-bold ${
                      s.balance > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {s.balance > 0 ? 'Payable' : 'Settled'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-3">
                    {s.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400" /> {s.phone}
                      </span>
                    )}
                    {s.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" /> {s.city}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/parties/ledger?partyId=${s.id}`}
                    className="inline-flex items-center gap-1 text-sky-600 font-bold bg-sky-50 px-2.5 py-1 rounded-lg text-xs hover:bg-sky-100 transition"
                  >
                    Statement <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Table */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Supplier Name</th>
                <th className="p-3.5">GSTIN</th>
                <th className="p-3.5">Phone / Mobile</th>
                <th className="p-3.5">City</th>
                <th className="p-3.5 text-right">Outstanding Payable</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-600">No Suppliers Found</p>
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-bold text-slate-900">{s.name}</td>
                    <td className="p-3.5 font-mono text-slate-600">{s.gstin || 'Unregistered'}</td>
                    <td className="p-3.5 text-slate-600">{s.phone || '-'}</td>
                    <td className="p-3.5 text-slate-600">{s.city || '-'}</td>
                    <td className="p-3.5 text-right font-black text-sm">
                      <span className={s.balance > 0 ? 'text-rose-600' : 'text-slate-700'}>
                        {formatCurrency(s.balance)}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.balance > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {s.balance > 0 ? 'Payable' : 'Settled'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <PartyActions partyId={s.id} partyName={s.name} partyType="SUPPLIER" />
                    </td>
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

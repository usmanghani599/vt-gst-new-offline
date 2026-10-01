'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Calendar,
  LogOut,
  Clock,
  ShieldAlert,
  Menu,
} from 'lucide-react';
import { AuthContext } from '@/lib/auth';
import { BluetoothPrinterBadge } from './bluetooth-printer-modal';

interface NavbarProps {
  authContext: AuthContext | null;
  onOpenMobileMenu?: () => void;
}

export function Navbar({ authContext, onOpenMobileMenu }: NavbarProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const company = authContext?.company;
  const fy = authContext?.financialYear;
  const user = authContext?.user;
  const account = authContext?.account;

  // Compute trial days remaining if TRIAL
  let trialDaysRemaining: number | null = null;
  if (account?.status === 'TRIAL' && account.trialEndsAt) {
    const diffTime = new Date(account.trialEndsAt).getTime() - new Date().getTime();
    trialDaysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 flex items-center justify-between px-3 sm:px-6 z-10 shrink-0 no-print gap-2">
      {/* Left: Mobile Hamburger Toggle + Company / FY Badges */}
      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition focus:outline-none"
          title="Open Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {user?.isSuperAdmin ? (
          <div className="flex items-center gap-2 bg-blue-50 px-2.5 sm:px-3.5 py-1.5 rounded-xl border border-blue-200">
            <ShieldAlert className="h-4 w-4 text-blue-700 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-blue-950 leading-tight truncate">
                Super Admin
              </span>
              <span className="text-[10px] text-blue-600 font-semibold leading-none hidden sm:block">
                Master Control Center
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Company Badge -> Clickable to Company Settings */}
            <button
              type="button"
              onClick={() => router.push('/company/settings')}
              title="Click to view & edit Company Settings"
              className="flex items-center gap-2 bg-slate-100/90 hover:bg-slate-200 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 text-left transition group cursor-pointer max-w-[150px] sm:max-w-[240px]"
            >
              <Building2 className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-800 leading-tight group-hover:text-blue-700 truncate">
                  {company?.name || 'My Company'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono leading-none truncate hidden sm:block">
                  GSTIN: {company?.gstin || 'Unregistered'}
                </span>
              </div>
            </button>

            {/* Financial Year Badge (Hidden on very narrow mobile) */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-100/80 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-800 leading-tight">
                    FY {fy?.name || '2026-27'}
                  </span>
                  {fy?.isClosed && (
                    <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-bold uppercase">
                      Closed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 10-Day Free Trial Notice */}
            {trialDaysRemaining !== null && (
              <div className="hidden lg:flex items-center gap-2 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1 rounded-xl text-xs font-medium">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                <span>
                  <strong>{trialDaysRemaining}d</strong> Trial
                </span>
                <button
                  onClick={() => router.push('/desktop/settings')}
                  className="ml-1 text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-bold px-2 py-0.5 rounded-lg transition"
                >
                  Upgrade
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Right User Actions & Bluetooth Badge */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <BluetoothPrinterBadge />

        <div className="text-right hidden sm:block">
          <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
            {user?.name || 'User'}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            {user?.isSuperAdmin ? 'Super Admin' : company?.role || 'Staff'}
          </div>
        </div>

        <button
          onClick={handleLogout}
          title="Sign Out"
          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition border border-transparent hover:border-red-200"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

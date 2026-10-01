'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Small UI kit for desktop-only screens, using the same palette as the online app. */

export const inputClass =
  'w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('bg-white rounded-2xl border border-slate-200 shadow-sm', className)}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

type Tone = 'primary' | 'secondary' | 'danger' | 'success';
const tones: Record<Tone, string> = {
  primary: 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
  danger: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
};

export function Button({
  tone = 'primary',
  busy,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={busy || rest.disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]',
        tones[tone],
        className
      )}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info' | 'warning'; children: React.ReactNode }) {
  const styles = {
    error: 'bg-rose-50 border-rose-200 text-rose-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    info: 'bg-sky-50 border-sky-200 text-sky-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
  }[tone];
  return <div className={cn('border text-xs font-semibold px-4 py-3 rounded-xl', styles)}>{children}</div>;
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/app_icon.png" alt="VTGST" className="h-10 w-10 rounded-xl shadow-sm" />
      <div>
        <div className="text-xl font-black tracking-tight bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent">
          VTGST Desktop
        </div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
    </div>
  );
}

export function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gradient-to-br from-sky-200/50 to-cyan-100/40 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-gradient-to-tr from-blue-200/40 to-sky-100/30 blur-3xl" />
      <div className="relative w-full max-w-xl">{children}</div>
    </div>
  );
}

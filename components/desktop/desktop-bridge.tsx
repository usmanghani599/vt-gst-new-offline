'use client';

/**
 * Mounted once in the root layout (desktop patch).
 * - Routes every existing `window.print()` button through Electron, which
 *   prints silently to the configured printer when "silent print" is on.
 * - Shows a small sync indicator when this computer is linked to online.
 */
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Cloud, CloudOff, RefreshCcw } from 'lucide-react';
import { desktop, type SyncStatusInfo } from './bridge';

export function DesktopBridge() {
  const pathname = usePathname();
  const [sync, setSync] = useState<SyncStatusInfo | null>(null);

  useEffect(() => {
    const d = desktop();
    if (!d) return;
    const original = window.print.bind(window);
    window.print = () => {
      const kind = /\/pos(\/|$)|receipt/i.test(window.location.pathname) ? 'receipt' : 'document';
      d.print.print({ kind }).then((r) => {
        if (!r.ok && r.error) alert(`Print failed: ${r.error}`);
      }).catch(() => original());
    };
    return () => {
      window.print = original;
    };
  }, []);

  useEffect(() => {
    const d = desktop();
    if (!d) return;
    let alive = true;
    const load = () => d.sync.status().then((s) => alive && setSync(s)).catch(() => {});
    load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pathname]);

  if (!sync?.linked || pathname?.startsWith('/desktop/locked')) return null;

  const offline = sync.online === false;
  return (
    <div className="no-print fixed bottom-3 right-3 z-40 hidden md:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
      {offline ? <CloudOff className="h-3.5 w-3.5 text-amber-500" /> : sync.running ? <RefreshCcw className="h-3.5 w-3.5 animate-spin text-sky-600" /> : <Cloud className="h-3.5 w-3.5 text-emerald-500" />}
      <span>
        {offline ? 'Offline — saved on this computer' : sync.running ? 'Syncing…' : 'Synced'}
        {sync.pending > 0 ? ` · ${sync.pending} pending` : ''}
      </span>
    </div>
  );
}

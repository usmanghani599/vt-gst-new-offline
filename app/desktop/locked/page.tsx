'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Wifi, KeyRound, HardDriveDownload } from 'lucide-react';
import { desktop, type LicenseInfo } from '@/components/desktop/bridge';
import { Alert, Brand, Button, Card, CenteredScreen } from '@/components/desktop/ui';

/** Shown whenever the license cannot be used. Data is never deleted; a backup can always be taken. */
export default function LockedPage() {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    desktop()?.license.info().then(setInfo).catch(() => {});
  }, []);

  async function checkNow() {
    const d = desktop();
    if (!d) return;
    setBusy('check');
    setMsg(null);
    try {
      const i = await d.license.checkNow();
      setInfo(i);
      if (i.state === 'VALID' || i.state === 'CHECK_DUE') window.location.href = '/dashboard';
      else setMsg({ tone: 'error', text: i.message });
    } catch (e: any) {
      setMsg({ tone: 'error', text: e.message });
    } finally {
      setBusy(null);
    }
  }

  async function backupToFile() {
    const d = desktop();
    if (!d) return;
    setBusy('backup');
    setMsg(null);
    try {
      const r = await d.backup.backupNow('file');
      setMsg(r.ok ? { tone: 'success', text: `Encrypted backup saved: ${r.name}` } : { tone: 'error', text: r.error || 'Backup failed' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <CenteredScreen>
      <Card className="p-7 space-y-5">
        <Brand subtitle={info?.customer || undefined} />
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">License check needed</h1>
            <p className="text-sm text-slate-600 mt-0.5">{info?.message || 'Checking license…'}</p>
          </div>
        </div>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Alert tone="info">Your business data is safe and stays encrypted on this computer. It will be available again as soon as the license is verified.</Alert>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button busy={busy === 'check'} onClick={checkNow}>
            <Wifi className="h-4 w-4" /> Verify online now
          </Button>
          <Button tone="secondary" onClick={() => desktop()?.license.openActivation()}>
            <KeyRound className="h-4 w-4" /> Enter license key
          </Button>
          <Button tone="secondary" busy={busy === 'backup'} onClick={backupToFile}>
            <HardDriveDownload className="h-4 w-4" /> Save backup
          </Button>
        </div>
      </Card>
    </CenteredScreen>
  );
}

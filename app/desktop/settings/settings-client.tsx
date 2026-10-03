'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyRound,
  RefreshCcw,
  Cloud,
  CloudOff,
  HardDrive,
  Printer,
  ShieldCheck,
  Link2,
  Unlink,
  Upload,
  Download,
  FolderOpen,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import {
  desktop,
  type BackupFile,
  type BackupInfo,
  type LicenseInfo,
  type PrinterInfo,
  type PrintSettings,
  type SyncStatusInfo,
} from '@/components/desktop/bridge';
import { Alert, Button, Card, Field, inputClass } from '@/components/desktop/ui';
import { cn } from '@/lib/utils';

type Tab = 'license' | 'sync' | 'backup' | 'print';
type Msg = { tone: 'error' | 'success' | 'info' | 'warning'; text: string } | null;

const fmt = (v: string | number | null | undefined) =>
  v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export function DesktopSettingsClient({
  isOwner,
  activeCompany,
  companies,
}: {
  isOwner: boolean;
  activeCompany: { id: string; name: string } | null;
  companies: { id: string; name: string; gstin: string | null }[];
}) {
  const [tab, setTab] = useState<Tab>(isOwner ? 'license' : 'print');
  const d = typeof window !== 'undefined' ? desktop() : null;

  const tabs: { id: Tab; label: string; icon: React.ElementType; ownerOnly?: boolean }[] = [
    { id: 'license', label: 'License', icon: KeyRound, ownerOnly: true },
    { id: 'sync', label: 'Online Sync', icon: RefreshCcw, ownerOnly: true },
    { id: 'backup', label: 'Google Backup', icon: HardDrive, ownerOnly: true },
    { id: 'print', label: 'Printing', icon: Printer },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <ShieldCheck className="h-7 w-7 text-sky-600" /> Desktop Settings
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">License, online sync, encrypted Google Drive backup and silent printing for this computer.</p>
      </div>

      {!d && <Alert tone="warning">These settings are available only inside the VTGST desktop app.</Alert>}

      <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-semibold flex-wrap">
        {tabs
          .filter((t) => isOwner || !t.ownerOnly)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer',
                tab === t.id ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
      </div>

      {d && tab === 'license' && isOwner && <LicenseTab />}
      {d && tab === 'sync' && isOwner && <SyncTab activeCompany={activeCompany} companies={companies} />}
      {d && tab === 'backup' && isOwner && <BackupTab />}
      {d && tab === 'print' && <PrintTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs">
      <span className="text-slate-500 font-semibold">{label}</span>
      <span className="text-slate-900 font-bold text-right">{value}</span>
    </div>
  );
}

function LicenseTab() {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    desktop()!.license.info().then(setInfo).catch((e) => setMsg({ tone: 'error', text: e.message }));
  }, []);

  async function check() {
    setBusy('check');
    setMsg(null);
    try {
      const i = await desktop()!.license.checkNow();
      setInfo(i);
      setMsg({ tone: i.state === 'VALID' ? 'success' : 'warning', text: i.message });
    } catch (e: any) {
      setMsg({ tone: 'error', text: e.message });
    } finally {
      setBusy(null);
    }
  }

  async function deactivate() {
    if (!confirm('Deactivate this computer? The app will lock here and the license seat becomes free for another computer. Your data stays on this computer.')) return;
    setBusy('deactivate');
    const r = await desktop()!.license.deactivate();
    setBusy(null);
    if (!r.ok) setMsg({ tone: 'error', text: r.error || 'Could not deactivate' });
  }

  async function changeKey() {
    if (
      !confirm(
        'Change to another license key?\n\n' +
          '• This computer is released from the current license (internet needed).\n' +
          '• Your business data stays on this computer.\n' +
          '• If the new key belongs to a different license, set your backup password again afterwards; ' +
          'older backups still open with their old password on the old license.'
      )
    )
      return;
    setBusy('change');
    setMsg(null);
    const r = await desktop()!.license.change();
    setBusy(null);
    if (!r.ok) setMsg({ tone: 'error', text: r.error || 'Could not change the license key' });
  }

  const good = info?.state === 'VALID' || info?.state === 'CHECK_DUE';
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">License</h2>
          <span
            className={cn(
              'px-2 py-0.5 rounded-lg border text-[10px] font-bold',
              good ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            )}
          >
            {info?.state || '…'}
          </span>
        </div>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {info && (
          <div>
            <Row label="Licensed to" value={info.customer} />
            <Row label="Email" value={info.email} />
            <Row label="License key" value={<span className="font-mono">{info.licenseKeyMasked}</span>} />
            <Row label="This computer" value={info.deviceName} />
            <Row label="Valid until" value={info.expiresAt ? fmt(info.expiresAt) : 'Lifetime'} />
            <Row label="Last online verification" value={fmt(info.lastCheckAt)} />
            <Row label="Must verify online before" value={fmt(info.nextCheckBy)} />
            <Row label="Online sync" value={info.allowSync ? 'Included' : 'Not included'} />
            <Row label="Google Drive backup" value={info.allowBackup ? 'Included' : 'Not included'} />
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button busy={busy === 'check'} onClick={check}>
            <RefreshCcw className="h-4 w-4" /> Verify now
          </Button>
          <Button tone="secondary" busy={busy === 'change'} onClick={changeKey}>
            <KeyRound className="h-4 w-4" /> Change license key
          </Button>
          <Button tone="danger" busy={busy === 'deactivate'} onClick={deactivate}>
            Deactivate this computer
          </Button>
        </div>
      </Card>
      <Card className="p-5 space-y-2 text-xs text-slate-600">
        <h2 className="text-sm font-black text-slate-900">How licensing works</h2>
        <p>The license is bound to this computer and signed by the VTGST server, so it cannot be copied or edited.</p>
        <p>The app works fully offline. It only needs internet occasionally to re-verify the license — before the date shown on the left. Only license details are sent, never your business data.</p>
        <p>To move to a new computer: take a backup, deactivate here, then activate the new computer with the same key and restore.</p>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SyncTab({
  activeCompany,
  companies,
}: {
  activeCompany: { id: string; name: string } | null;
  companies: { id: string; name: string; gstin: string | null }[];
}) {
  const [status, setStatus] = useState<SyncStatusInfo | null>(null);
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [creds, setCreds] = useState({ email: '', password: '' });
  const [companyId, setCompanyId] = useState(activeCompany?.id || '');

  const load = useCallback(() => {
    desktop()!.sync.status().then(setStatus).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    desktop()!.license.info().then(setLicense).catch(() => {});
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(key: string, fn: () => Promise<SyncStatusInfo>, ok: string) {
    setBusy(key);
    setMsg(null);
    try {
      const s = await fn();
      setStatus(s);
      setMsg(s.lastError ? { tone: 'error', text: s.lastError } : { tone: 'success', text: ok });
    } catch (e: any) {
      setMsg({ tone: 'error', text: e.message });
    } finally {
      setBusy(null);
    }
  }

  if (license && !license.allowSync) {
    return <Alert tone="warning">Online sync is not included in your license. Contact VTGST to enable it.</Alert>;
  }

  if (status && !status.linked) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <CloudOff className="h-4 w-4 text-slate-400" /> Offline only
          </h2>
          <p className="text-xs text-slate-600">
            This computer is not connected to online. All data stays only on this computer, encrypted.
          </p>
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <Field label="Company to upload to your online account">
            <select className={inputClass} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Online email (license owner)">
              <input type="email" className={inputClass} value={creds.email} onChange={(e) => setCreds({ ...creds, email: e.target.value })} />
            </Field>
            <Field label="Online password">
              <input type="password" className={inputClass} value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} />
            </Field>
          </div>
          <Button
            busy={busy === 'link'}
            disabled={!creds.email || !creds.password || !companyId}
            onClick={() =>
              act('link', () => desktop()!.sync.link({ ...creds, mode: 'upload', companyId }), 'Linked. Your company is uploaded and will stay in sync.')
            }
          >
            <Link2 className="h-4 w-4" /> Join online & upload company
          </Button>
        </Card>
        <Card className="p-5 space-y-2 text-xs text-slate-600">
          <h2 className="text-sm font-black text-slate-900">What happens when you join online</h2>
          <p>• All data of the selected company is uploaded to your online VTGST account (web & mobile).</p>
          <p>• You keep working locally. Without internet, everything is saved on this computer and synced automatically when the connection returns.</p>
          <p>• Changes made online (web/mobile) come down to this computer.</p>
          <p>• Invoices made here get their own number series (for example DK7Q-INV/2026-27/00001), so numbers never clash with online.</p>
          <p>• Other companies on this computer stay offline only.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Cloud className="h-4 w-4 text-emerald-500" /> Synced with online
          {status?.online === false && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">Offline now</span>}
        </h2>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {status && (
          <div>
            <Row label="Company" value={companies.find((c) => c.id === status.linkedCompanyId)?.name || status.linkedCompanyId} />
            <Row label="Device number series" value={<span className="font-mono">{status.seriesCode}</span>} />
            <Row label="Changes waiting to upload" value={status.pending} />
            <Row label="Last sync" value={fmt(status.lastSyncAt)} />
            <Row label="Last full verification" value={fmt(status.lastReconcileAt)} />
            {status.lastError && <Row label="Last error" value={<span className="text-rose-600">{status.lastError}</span>} />}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button busy={busy === 'run' || status?.running} onClick={() => act('run', () => desktop()!.sync.run(), 'Sync complete.')}>
            <RefreshCcw className="h-4 w-4" /> Sync now
          </Button>
          <Button tone="secondary" busy={busy === 'deep'} onClick={() => act('deep', () => desktop()!.sync.run(true), 'Full verification complete.')}>
            <CheckCircle2 className="h-4 w-4" /> Full verify
          </Button>
          <Button
            tone="danger"
            busy={busy === 'unlink'}
            onClick={() => {
              if (confirm('Stop syncing this computer? Data stays both online and here, but changes will no longer be exchanged.')) {
                act('unlink', () => desktop()!.sync.unlink(), 'Unlinked. This computer is offline only now.');
              }
            }}
          >
            <Unlink className="h-4 w-4" /> Unlink
          </Button>
        </div>
      </Card>
      <Card className="p-5 space-y-2">
        <h2 className="text-sm font-black text-slate-900">Items that could not sync</h2>
        {!status?.failed?.length && <p className="text-xs text-slate-500">Everything is in sync.</p>}
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
          {status?.failed?.map((f) => (
            <div key={`${f.model}:${f.id}`} className="py-2 text-xs">
              <div className="font-bold text-slate-700">
                {f.model} <span className="font-mono text-slate-400">{f.id.slice(0, 8)}</span>
              </div>
              <div className="text-rose-600">{f.message}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function BackupTab() {
  const [info, setInfo] = useState<BackupInfo | null>(null);
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [restorePw, setRestorePw] = useState('');

  const refreshFiles = useCallback(async () => {
    try {
      setFiles(await desktop()!.backup.listGoogle());
    } catch {
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    desktop()!.backup.info().then((i) => {
      setInfo(i);
      if (i.googleEmail) refreshFiles();
    });
  }, [refreshFiles]);

  async function run<T>(key: string, fn: () => Promise<T>, ok?: (r: T) => string) {
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      if (ok) setMsg({ tone: 'success', text: ok(r) });
      return r;
    } catch (e: any) {
      setMsg({ tone: 'error', text: e.message });
      return null;
    } finally {
      setBusy(null);
    }
  }

  if (!info) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Lock className="h-4 w-4 text-sky-600" /> 1. Backup password
          </h2>
          <p className="text-xs text-slate-600">
            Backups are encrypted with AES-256 using this password plus a secret held by the VTGST license server. Without both, a backup
            file cannot be opened by anyone — including us. Keep this password safe; it cannot be recovered.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {info.hasPassword && (
              <input type="password" placeholder="Current" className={inputClass} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            )}
            <input type="password" placeholder="New password" className={inputClass} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <input type="password" placeholder="Confirm" className={inputClass} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </div>
          <Button
            busy={busy === 'pw'}
            disabled={pw.next.length < 8 || pw.next !== pw.confirm}
            onClick={async () => {
              const r = await run('pw', () => desktop()!.backup.setPassword(pw.next, pw.current), () => 'Backup password saved.');
              if (r) {
                setInfo(r);
                setPw({ current: '', next: '', confirm: '' });
              }
            }}
          >
            {info.hasPassword ? 'Change password' : 'Set password'}
          </Button>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Cloud className="h-4 w-4 text-sky-600" /> 2. Google Drive
          </h2>
          {!info.googleConfigured && <Alert tone="warning">Google backup is not configured in this build.</Alert>}
          <p className="text-xs text-slate-600">
            Only the licensed email <b>{info.licensedEmail}</b> can be connected. Backups go to a private app folder in that Google Drive that
            is hidden from the normal Drive view.
          </p>
          {info.googleEmail ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs">
              <span className="font-bold text-emerald-800">Connected: {info.googleEmail}</span>
              <button
                className="text-rose-600 font-bold cursor-pointer"
                onClick={async () => {
                  const r = await run('gdis', () => desktop()!.backup.disconnectGoogle());
                  if (r) {
                    setInfo(r);
                    setFiles([]);
                  }
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <Button
              busy={busy === 'gcon'}
              disabled={!info.googleConfigured}
              onClick={async () => {
                const r = await run('gcon', () => desktop()!.backup.connectGoogle(), (i) => `Connected ${i.googleEmail}`);
                if (r) {
                  setInfo(r);
                  refreshFiles();
                }
              }}
            >
              Connect Google account
            </Button>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-black text-slate-900">3. Automatic backup</h2>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={info.auto.enabled}
              onChange={async (e) => setInfo(await desktop()!.backup.saveAuto({ ...info.auto, enabled: e.target.checked }))}
            />
            Back up automatically
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Every (hours)">
              <input
                type="number"
                min={1}
                max={168}
                className={inputClass}
                value={info.auto.hours}
                onChange={async (e) => setInfo(await desktop()!.backup.saveAuto({ ...info.auto, hours: Number(e.target.value) || 24 }))}
              />
            </Field>
            <Field label="Keep last (backups)">
              <input
                type="number"
                min={3}
                max={365}
                className={inputClass}
                value={info.auto.keep}
                onChange={async (e) => setInfo(await desktop()!.backup.saveAuto({ ...info.auto, keep: Number(e.target.value) || 30 }))}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">
              Also copy to folder: <b>{info.auto.localFolder || 'not set'}</b>
            </span>
            <Button tone="secondary" onClick={async () => setInfo(await desktop()!.backup.chooseLocalFolder())}>
              <FolderOpen className="h-4 w-4" /> Choose folder
            </Button>
          </div>
          <div className="text-[11px] text-slate-500">
            Last backup: {fmt(info.lastBackupAt)}
            {info.lastBackupError && <span className="text-rose-600"> · {info.lastBackupError}</span>}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-black text-slate-900">Back up now</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              busy={busy === 'bg'}
              disabled={!info.hasPassword || !info.googleEmail}
              onClick={async () => {
                const r = await run('bg', () => desktop()!.backup.backupNow('google'));
                if (r) {
                  setMsg(r.ok ? { tone: 'success', text: `Uploaded ${r.name}` } : { tone: 'error', text: r.error || 'Backup failed' });
                  refreshFiles();
                }
              }}
            >
              <Upload className="h-4 w-4" /> To Google Drive
            </Button>
            <Button
              tone="secondary"
              busy={busy === 'bf'}
              disabled={!info.hasPassword}
              onClick={async () => {
                const r = await run('bf', () => desktop()!.backup.backupNow('file'));
                if (r) setMsg(r.ok ? { tone: 'success', text: `Saved ${r.name}` } : { tone: 'error', text: r.error || 'Backup failed' });
              }}
            >
              <HardDrive className="h-4 w-4" /> Save to file…
            </Button>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-black text-slate-900">Restore</h2>
          <Alert tone="warning">Restoring replaces ALL data on this computer with the backup. A safety copy of the current data is kept.</Alert>
          <Field label="Backup password">
            <input type="password" className={inputClass} value={restorePw} onChange={(e) => setRestorePw(e.target.value)} />
          </Field>
          <Button
            tone="secondary"
            busy={busy === 'rf'}
            disabled={!restorePw}
            onClick={async () => {
              if (!confirm('Replace all data on this computer with the selected backup file?')) return;
              const r = await run('rf', () => desktop()!.backup.restoreFile(restorePw));
              if (r && !r.ok) setMsg({ tone: 'error', text: r.error || 'Restore failed' });
            }}
          >
            <Download className="h-4 w-4" /> Restore from file…
          </Button>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {files.map((f) => (
              <div key={f.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-700">{f.name}</div>
                  <div className="text-slate-400">
                    {fmt(f.createdTime)} · {(f.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <Button
                  tone="secondary"
                  busy={busy === f.id}
                  disabled={!restorePw}
                  onClick={async () => {
                    if (!confirm(`Replace all data on this computer with ${f.name}?`)) return;
                    const r = await run(f.id, () => desktop()!.backup.restoreGoogle(f.id, restorePw));
                    if (r && !r.ok) setMsg({ tone: 'error', text: r.error || 'Restore failed' });
                  }}
                >
                  Restore
                </Button>
              </div>
            ))}
            {info.googleEmail && !files.length && <div className="py-3 text-xs text-slate-400">No backups in Google Drive yet.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PrintTab() {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const d = desktop()!;
    d.print.printers().then(setPrinters);
    d.print.getSettings().then(setSettings);
  }, []);

  async function save(next: PrintSettings) {
    setSettings(await desktop()!.print.saveSettings(next));
    setMsg({ tone: 'success', text: 'Printer settings saved.' });
  }

  if (!settings) return null;
  const printerSelect = (value: string, onChange: (v: string) => void) => (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">System default printer</option>
      {printers.map((p) => (
        <option key={p.name} value={p.name}>
          {p.displayName}
          {p.isDefault ? ' (default)' : ''}
        </option>
      ))}
    </select>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Printer className="h-4 w-4 text-sky-600" /> Printing
        </h2>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" className="mt-0.5" checked={settings.silent} onChange={(e) => save({ ...settings, silent: e.target.checked })} />
          <span>
            <b className="text-slate-800">Silent print</b>
            <span className="block text-slate-500">Print directly to the printer below without showing the print dialog.</span>
          </span>
        </label>
        <Field label="Invoices, reports & A4 documents">{printerSelect(settings.documentPrinter, (v) => save({ ...settings, documentPrinter: v }))}</Field>
        <Field label="POS receipts (thermal printer)">{printerSelect(settings.receiptPrinter, (v) => save({ ...settings, receiptPrinter: v }))}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Receipt paper width">
            <select
              className={inputClass}
              value={settings.receiptWidthMm}
              onChange={(e) => save({ ...settings, receiptWidthMm: Number(e.target.value) as 58 | 80 })}
            >
              <option value={80}>80 mm</option>
              <option value={58}>58 mm</option>
            </select>
          </Field>
          <Field label="Copies">
            <input
              type="number"
              min={1}
              max={5}
              className={inputClass}
              value={settings.copies}
              onChange={(e) => save({ ...settings, copies: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </Field>
        </div>
        <div className="flex gap-2">
          {(['document', 'receipt'] as const).map((k) => (
            <Button
              key={k}
              tone="secondary"
              busy={busy === k}
              onClick={async () => {
                setBusy(k);
                const r = await desktop()!.print.test(k);
                setBusy(null);
                setMsg(r.ok ? { tone: 'success', text: 'Test page sent.' } : { tone: 'error', text: r.error || 'Print failed' });
              }}
            >
              Test {k === 'document' ? 'A4' : 'receipt'}
            </Button>
          ))}
        </div>
      </Card>
      <Card className="p-5 space-y-2 text-xs text-slate-600">
        <h2 className="text-sm font-black text-slate-900">Tips</h2>
        <p>Every Print button in the app uses these settings. POS screens use the receipt printer; everything else uses the document printer.</p>
        <p>Bluetooth printing from the mobile app is not used on desktop — connect the thermal printer through Windows/macOS and pick it here.</p>
      </Card>
    </div>
  );
}

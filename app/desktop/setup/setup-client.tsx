'use client';

import React, { useState } from 'react';
import { Building2, CloudDownload, HardDriveDownload, CheckCircle2 } from 'lucide-react';
import { desktop } from '@/components/desktop/bridge';
import { Alert, Brand, Button, Card, CenteredScreen, Field, inputClass } from '@/components/desktop/ui';
import { cn } from '@/lib/utils';

type Mode = 'new' | 'download' | 'restore';

export function SetupClient({ states }: { states: { name: string; code: string }[] }) {
  const [mode, setMode] = useState<Mode>('new');
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    password: '',
    confirm: '',
    companyName: '',
    gstin: '',
    stateCode: '27',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string; gstin: string | null }[] | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function createOwner(m: 'new' | 'download') {
    const res = await fetch('/api/local/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, mode: m }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Setup failed');
    return data;
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await createOwner('new');
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function findOnlineCompanies(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const d = desktop();
    if (!d) return setError('Available only in the desktop app.');
    setBusy(true);
    try {
      const res = await d.sync.companies(form.email, form.password);
      if (!res.companies.length) throw new Error('No companies found in this online account.');
      setCompanies(res.companies);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadCompany(companyId: string) {
    const d = desktop();
    if (!d) return;
    setError(null);
    setBusy(true);
    try {
      setProgress('Creating your login on this computer…');
      await createOwner('download');
      setProgress('Downloading your company data. This can take a few minutes…');
      const status = await d.sync.link({ email: form.email, password: form.password, mode: 'download', companyId });
      if (status.lastError) throw new Error(status.lastError);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  async function restore(from: 'google' | 'file') {
    const d = desktop();
    if (!d) return;
    setError(null);
    setBusy(true);
    try {
      if (from === 'google') {
        await d.backup.connectGoogle();
        const files = await d.backup.listGoogle();
        if (!files.length) throw new Error('No backups found in your Google account.');
        setProgress(`Restoring ${files[0].name}…`);
        const r = await d.backup.restoreGoogle(files[0].id, restorePassword);
        if (!r.ok) throw new Error(r.error || 'Restore failed');
      } else {
        const r = await d.backup.restoreFile(restorePassword);
        if (!r.ok) throw new Error(r.error || 'Restore failed');
      }
    } catch (err: any) {
      setError(err.message);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Mode; label: string; icon: React.ElementType; desc: string }[] = [
    { id: 'new', label: 'New company', icon: Building2, desc: 'Start fresh on this computer' },
    { id: 'download', label: 'From online', icon: CloudDownload, desc: 'Download my online company' },
    { id: 'restore', label: 'Restore backup', icon: HardDriveDownload, desc: 'From Google Drive or file' },
  ];

  return (
    <CenteredScreen>
      <Card className="p-7 space-y-6">
        <Brand subtitle="Let’s set up this computer" />

        <div className="grid grid-cols-3 gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setMode(t.id);
                setError(null);
                setCompanies(null);
              }}
              className={cn(
                'text-left p-3 rounded-xl border transition cursor-pointer',
                mode === t.id ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/20' : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <t.icon className={cn('h-4 w-4 mb-1', mode === t.id ? 'text-sky-600' : 'text-slate-400')} />
              <div className="text-xs font-bold text-slate-800">{t.label}</div>
              <div className="text-[10px] text-slate-500">{t.desc}</div>
            </button>
          ))}
        </div>

        {error && <Alert>{error}</Alert>}
        {progress && <Alert tone="info">{progress}</Alert>}

        {mode === 'new' && (
          <form onSubmit={submitNew} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your name">
                <input required className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <Field label="Mobile">
                <input className={inputClass} value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
              </Field>
              <Field label="Login email">
                <input required type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} />
              </Field>
              <Field label="Company / shop name">
                <input required className={inputClass} value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
              </Field>
              <Field label="Password" hint="At least 8 characters">
                <input required type="password" minLength={8} className={inputClass} value={form.password} onChange={(e) => set('password', e.target.value)} />
              </Field>
              <Field label="Confirm password">
                <input required type="password" className={inputClass} value={form.confirm} onChange={(e) => set('confirm', e.target.value)} />
              </Field>
              <Field label="GSTIN (optional)">
                <input className={inputClass} value={form.gstin} onChange={(e) => set('gstin', e.target.value)} />
              </Field>
              <Field label="State">
                <select className={inputClass} value={form.stateCode} onChange={(e) => set('stateCode', e.target.value)}>
                  {states.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Alert tone="info">Your data is stored encrypted on this computer only. Nothing is uploaded unless you link online sync later.</Alert>
            <Button type="submit" busy={busy} className="w-full py-3">
              <CheckCircle2 className="h-4 w-4" /> Create company & start
            </Button>
          </form>
        )}

        {mode === 'download' && !companies && (
          <form onSubmit={findOnlineCompanies} className="space-y-4">
            <Alert tone="info">Sign in with the online VTGST account of the license owner. The company is downloaded and kept in sync.</Alert>
            <Field label="Your name (for this computer)">
              <input required className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Online email">
              <input required type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Online password" hint="This also becomes your password on this computer.">
              <input required type="password" minLength={8} className={inputClass} value={form.password} onChange={(e) => set('password', e.target.value)} />
            </Field>
            <Button type="submit" busy={busy} className="w-full py-3">
              <CloudDownload className="h-4 w-4" /> Find my companies
            </Button>
          </form>
        )}

        {mode === 'download' && companies && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-600">Choose the company to download</div>
            {companies.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => downloadCompany(c.id)}
                className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50 transition cursor-pointer disabled:opacity-60"
              >
                <div className="text-sm font-bold text-slate-800">{c.name}</div>
                <div className="text-[11px] text-slate-500">{c.gstin || 'No GSTIN'}</div>
              </button>
            ))}
          </div>
        )}

        {mode === 'restore' && (
          <div className="space-y-4">
            <Alert tone="info">
              Backups can only be opened on a computer activated with the same license, using your backup password.
            </Alert>
            <Field label="Backup password">
              <input type="password" className={inputClass} value={restorePassword} onChange={(e) => setRestorePassword(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Button busy={busy} onClick={() => restore('google')} disabled={!restorePassword}>
                Latest from Google Drive
              </Button>
              <Button tone="secondary" busy={busy} onClick={() => restore('file')} disabled={!restorePassword}>
                Choose backup file…
              </Button>
            </div>
          </div>
        )}
      </Card>
    </CenteredScreen>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Alert, Brand, Button, Card, CenteredScreen, Field, inputClass } from '@/components/desktop/ui';

/** Owner password reset on this computer, verified with the license key + licensed email. */
export default function RecoverPage() {
  const [form, setForm] = useState({ licenseKey: '', email: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.newPassword !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const res = await fetch('/api/local/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reset password');
      setDone(data.email);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredScreen>
      <Card className="p-7 space-y-5">
        <Brand subtitle="Reset the owner password on this computer" />
        {done ? (
          <>
            <Alert tone="success">Password changed. Sign in as {done} with the new password.</Alert>
            <Link href="/login" className="block text-center text-sm font-bold text-sky-600">
              Go to sign in
            </Link>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field label="License key">
              <input required className={inputClass + ' font-mono uppercase'} value={form.licenseKey} onChange={(e) => set('licenseKey', e.target.value)} />
            </Field>
            <Field label="Licensed email">
              <input required type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="New password">
                <input required type="password" minLength={8} className={inputClass} value={form.newPassword} onChange={(e) => set('newPassword', e.target.value)} />
              </Field>
              <Field label="Confirm">
                <input required type="password" className={inputClass} value={form.confirm} onChange={(e) => set('confirm', e.target.value)} />
              </Field>
            </div>
            <Button type="submit" busy={busy} className="w-full py-3">
              Reset owner password
            </Button>
            <Link href="/login" className="block text-center text-xs font-semibold text-slate-500">
              Back to sign in
            </Link>
          </form>
        )}
      </Card>
    </CenteredScreen>
  );
}

import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { CompanySettingsForm } from './company-settings-form';
import { ChangePasswordCard } from '@/components/change-password-card';

export default async function CompanySettingsPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) return null;

  const [company, states] = await Promise.all([
    prisma.company.findUnique({
      where: { id: authContext.company.id },
      include: {
        state: true,
        bankAccounts: true,
      },
    }),
    prisma.state.findMany({
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <AppShell>
      <div className="max-w-4xl space-y-8 pb-12">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Company & Account Settings</h1>
          <p className="text-xs text-slate-500">
            Edit your business profile, GSTIN, PAN, registered address, default pricing mode, banking details, and login security
          </p>
        </div>

        <CompanySettingsForm initialCompany={company} states={states} />

        <ChangePasswordCard userEmail={authContext.user.email} />
      </div>
    </AppShell>
  );
}


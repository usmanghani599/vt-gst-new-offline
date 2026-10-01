import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppShellLayout } from './app-shell-layout';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect('/login');
  }

  return (
    <AppShellLayout authContext={authContext}>
      {children}
    </AppShellLayout>
  );
}

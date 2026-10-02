import React from 'react';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { SetupClient } from './setup-client';

export const dynamic = 'force-dynamic';

export default async function DesktopSetupPage() {
  if ((await prisma.user.count()) > 0) redirect('/login');
  const states = await prisma.state.findMany({
    where: { stateCodeGst: { not: null } },
    select: { name: true, stateCodeGst: true },
    orderBy: { name: 'asc' },
  });
  return <SetupClient states={states.map((s) => ({ name: s.name, code: s.stateCodeGst! }))} />;
}

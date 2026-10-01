import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { redirect } from 'next/navigation';
import { UnitsClient } from './units-client';

export default async function UnitsPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) {
    redirect('/login');
  }

  const companyId = authContext.company.id;

  const units = await prisma.unit.findMany({
    where: {
      OR: [{ companyId }, { isSystem: true }],
    },
    include: {
      _count: {
        select: { items: true },
      },
    },
    orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
  });

  const serialized = units.map((u) => ({
    id: u.id,
    code: u.code,
    name: u.name,
    uqcCode: u.uqcCode,
    isSystem: u.isSystem,
    isActive: u.isActive,
    companyId: u.companyId,
    _count: {
      items: u._count.items,
    },
  }));

  return (
    <AppShell>
      <UnitsClient initialUnits={serialized} />
    </AppShell>
  );
}

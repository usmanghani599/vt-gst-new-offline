import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { redirect } from 'next/navigation';
import { CategoriesClient } from './categories-client';

export default async function CategoriesPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) {
    redirect('/login');
  }

  const categories = await prisma.itemCategory.findMany({
    where: { companyId: authContext.company.id },
    include: {
      _count: {
        select: { items: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const serialized = categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    createdAt: c.createdAt.toISOString(),
    _count: {
      items: c._count.items,
    },
  }));

  return (
    <AppShell>
      <CategoriesClient initialCategories={serialized} />
    </AppShell>
  );
}

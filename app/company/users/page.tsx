import React from 'react';
import { getAuthContext } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import prisma from '@/lib/db';
import { CompanyUsersClient } from './company-users-client';
import { redirect } from 'next/navigation';

export default async function CompanyUsersPage() {
  const authContext = await getAuthContext();
  if (!authContext?.company) {
    redirect('/dashboard');
  }

  const companyId = authContext.company.id;

  const [companyUsers, salesmen] = await Promise.all([
    prisma.companyUser.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.salesman.findMany({
      where: { companyId },
    }),
  ]);

  const salesmanMap = new Map<string, any>();
  salesmen.forEach((sm) => {
    if (sm.userId) {
      salesmanMap.set(sm.userId, sm);
    }
  });

  const serializedUsers = companyUsers.map((cu) => {
    const linkedSm = cu.userId ? salesmanMap.get(cu.userId) : null;
    return {
      id: cu.id,
      userId: cu.userId,
      name: cu.user.name,
      email: cu.user.email,
      mobile: cu.user.mobile,
      role: cu.role,
      isActive: cu.isActive,
      userStatus: cu.user.status,
      joinedAt: cu.createdAt.toISOString(),
      salesman: linkedSm
        ? {
            id: linkedSm.id,
            employeeCode: linkedSm.employeeCode,
            commissionRate: Number(linkedSm.commissionRate),
            pointsPerAmount: Number(linkedSm.pointsPerAmount),
          }
        : null,
    };
  });

  return (
    <AppShell>
      <CompanyUsersClient
        initialUsers={serializedUsers}
        companyName={authContext.company.name}
        currentUserRole={authContext.company.role}
      />
    </AppShell>
  );
}

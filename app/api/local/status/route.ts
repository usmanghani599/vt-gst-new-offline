/** Read-only desktop status for the settings screen. */
import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import prisma from '@/lib/db';
import { getRuntime } from '@/lib/desktop-local/runtime';
import { getSyncStatus } from '@/lib/desktop-local/sync-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rt = getRuntime();
  const companies = await prisma.company.findMany({ select: { id: true, name: true, gstin: true } });
  return NextResponse.json({
    success: true,
    isOwner: auth.company?.role === 'OWNER',
    activeCompanyId: auth.company?.id || null,
    companies,
    sync: getSyncStatus(),
    license: {
      state: rt.license.state,
      customer: rt.license.payload?.name || null,
      email: rt.license.payload?.email || null,
      expiresAt: rt.license.payload?.exp || null,
      nextCheckBy: rt.license.payload?.chk || null,
      maxDevices: rt.license.payload?.maxDevices || null,
      allowSync: Boolean(rt.license.payload?.sync),
      allowBackup: Boolean(rt.license.payload?.backup),
      seriesCode: rt.license.payload?.series || null,
    },
    appVersion: rt.appVersion,
  });
}

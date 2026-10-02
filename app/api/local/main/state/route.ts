/** Lets the main process decide which screen to open (main process only). */
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [users, companies, countries] = await Promise.all([
    prisma.user.count(),
    prisma.company.findMany({ select: { id: true, name: true, gstin: true } }),
    prisma.country.count(),
  ]);
  return NextResponse.json({ success: true, users, companies, hasReferenceData: countries > 0 });
}

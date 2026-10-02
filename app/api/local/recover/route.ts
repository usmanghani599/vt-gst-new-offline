/**
 * Offline owner password recovery: proving knowledge of the license key and
 * the licensed email lets the owner set a new password on this computer.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { getRuntime } from '@/lib/desktop-local/runtime';

export const dynamic = 'force-dynamic';

let attempts: number[] = [];

const norm = (k: string) => String(k || '').trim().toUpperCase().replace(/\s+/g, '');

export async function POST(request: Request) {
  const now = Date.now();
  attempts = attempts.filter((t) => now - t < 15 * 60 * 1000);
  if (attempts.length >= 5) {
    return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  }
  attempts.push(now);

  const body = await request.json().catch(() => ({}));
  const rt = getRuntime();
  const keyOk = rt.license.licenseKey && norm(body.licenseKey) === norm(rt.license.licenseKey);
  const emailOk = rt.license.payload && String(body.email || '').trim().toLowerCase() === rt.license.payload.email.toLowerCase();
  if (!keyOk || !emailOk) {
    return NextResponse.json({ error: 'License key or email is not correct.' }, { status: 403 });
  }
  if (String(body.newPassword || '').length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }

  const account = await prisma.account.findFirst({ orderBy: { createdAt: 'asc' }, include: { ownerUser: true } });
  if (!account) return NextResponse.json({ error: 'No owner account on this computer yet.' }, { status: 404 });
  await prisma.user.update({
    where: { id: account.ownerUserId },
    data: { passwordHash: await hashPassword(String(body.newPassword)), status: 'ACTIVE' },
  });
  attempts = [];
  return NextResponse.json({ success: true, email: account.ownerUser.email });
}

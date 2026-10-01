/**
 * First-run setup on a fresh installation: creates the owner login, the local
 * account and (mode "new") the first company with its financial year.
 * Mode "download" creates only the owner login; the company then arrives from
 * the online account through sync.
 * Allowed only while the database has no users.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TaxMode } from '@prisma/client';
import prisma from '@/lib/db';
import { createSessionToken, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function currentFinancialYear(now = new Date()) {
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    name: `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`,
    startDate: new Date(`${startYear}-04-01T00:00:00Z`),
    endDate: new Date(`${startYear + 1}-03-31T23:59:59Z`),
  };
}

export async function POST(request: Request) {
  try {
    if ((await prisma.user.count()) > 0) {
      return NextResponse.json({ error: 'This computer is already set up. Please sign in.' }, { status: 409 });
    }
    const body = await request.json();
    const mode = body.mode === 'download' ? 'download' : 'new';
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!name || !email || password.length < 8) {
      return NextResponse.json({ error: 'Name, email and a password of at least 8 characters are required.' }, { status: 400 });
    }

    const india = await prisma.country.findUnique({ where: { code: 'IN' } });
    const country = india || (await prisma.country.findFirst());
    if (!country) {
      return NextResponse.json({ error: 'Master data missing. Restart the app while connected to the internet.' }, { status: 409 });
    }
    const state = body.stateCode ? await prisma.state.findFirst({ where: { stateCodeGst: String(body.stateCode) } }) : null;
    const passwordHash = await hashPassword(password);
    const fy = currentFinancialYear();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, mobile: body.mobile || null, passwordHash, status: 'ACTIVE' },
      });
      const account = await tx.account.create({
        data: {
          name: `${name}'s Account`,
          ownerUserId: user.id,
          trialStartedAt: new Date(),
          trialEndsAt: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
        },
      });
      let companyId: string | null = null;
      if (mode === 'new') {
        const company = await tx.company.create({
          data: {
            accountId: account.id,
            countryId: country.id,
            name: String(body.companyName || '').trim() || `${name} Enterprises`,
            gstin: body.gstin ? String(body.gstin).trim().toUpperCase() : null,
            stateId: state?.id,
            defaultTaxMode: TaxMode.TAX_EXCLUSIVE,
            currencyCode: country.currencyCode,
            currencySymbol: country.currencySymbol,
          },
        });
        companyId = company.id;
        await tx.companyUser.create({ data: { companyId, userId: user.id, role: 'OWNER' } });
        await tx.financialYear.create({ data: { companyId, ...fy, isClosed: false } });
        await tx.party.create({
          data: { companyId, name: 'Walk-in Retail Customer', partyType: 'CUSTOMER', isWalkIn: true, gstRegType: 'CONSUMER' },
        });
      }
      return { user, companyId };
    });

    const token = await createSessionToken({
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      isSuperAdmin: false,
    });
    const cookieStore = await cookies();
    cookieStore.set('vtgst_session', token, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 });
    return NextResponse.json({ success: true, companyId: result.companyId, mode });
  } catch (error: any) {
    console.error('Desktop setup error:', error);
    return NextResponse.json({ error: error.message || 'Setup failed' }, { status: 500 });
  }
}

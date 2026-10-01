import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyPassword, createSessionToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
    });

    const cookieStore = await cookies();
    cookieStore.set('vtgst_session', token, {
      httpOnly: true,
      secure: false, // desktop: loopback http
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    const ownedCompany = await prisma.company.findFirst({
      where: { account: { ownerUserId: user.id } },
      include: {
        financialYears: { orderBy: { startDate: 'desc' }, take: 1 },
        state: true,
      },
    });

    const companyUser = !ownedCompany
      ? await prisma.companyUser.findFirst({
          where: { userId: user.id, isActive: true },
          include: {
            company: {
              include: {
                financialYears: { orderBy: { startDate: 'desc' }, take: 1 },
                state: true,
              },
            },
          },
        })
      : null;

    const activeComp = ownedCompany || companyUser?.company;
    const activeFy = activeComp?.financialYears?.[0];

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
      },
      company: activeComp
        ? {
            id: activeComp.id,
            name: activeComp.name,
            legalName: activeComp.legalName,
            gstin: activeComp.gstin,
            phone: activeComp.phone,
            email: activeComp.email,
            address: activeComp.address,
            city: activeComp.city,
            defaultTaxMode: activeComp.defaultTaxMode,
            posEnableTax: activeComp.posEnableTax,
            currencySymbol: activeComp.currencySymbol,
          }
        : null,
      financialYear: activeFy
        ? {
            id: activeFy.id,
            name: activeFy.name,
            isClosed: activeFy.isClosed,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error during authentication' }, { status: 500 });
  }
}

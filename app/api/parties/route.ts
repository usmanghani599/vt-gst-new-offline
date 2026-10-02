import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import prisma from '@/lib/db';
import Decimal from 'decimal.js';

export async function GET(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partyType = searchParams.get('type'); // CUSTOMER, SUPPLIER, or null

    const companyId = authContext.company.id;
    const where: any = { companyId };
    if (partyType && (partyType === 'CUSTOMER' || partyType === 'SUPPLIER')) {
      where.partyType = { in: [partyType, 'BOTH'] };
    }

    const parties = await prisma.party.findMany({
      where,
      include: {
        ledgerEntries: true,
        state: true,
      },
      orderBy: { name: 'asc' },
    });

    const serialized = parties.map((p) => {
      let balance = new Decimal(
        p.openingBalanceType === 'DEBIT' ? p.openingBalance : p.openingBalance.negated()
      );

      for (const entry of p.ledgerEntries) {
        balance = balance.plus(new Decimal(entry.debit)).minus(new Decimal(entry.credit));
      }

      return {
        id: p.id,
        name: p.name,
        legalName: p.legalName,
        partyType: p.partyType,
        gstin: p.gstin,
        pan: p.pan,
        phone: p.phone,
        mobile: p.mobile,
        email: p.email,
        city: p.city,
        pincode: p.pincode,
        stateId: p.stateId,
        stateName: p.state?.name,
        billingAddress: p.billingAddress,
        shippingAddress: p.shippingAddress,
        creditLimit: new Decimal(p.creditLimit).toNumber(),
        openingBalance: new Decimal(p.openingBalance).toNumber(),
        openingBalanceType: p.openingBalanceType,
        balance: balance.toNumber(),
        balanceType: balance.greaterThanOrEqualTo(0) ? 'RECEIVABLE' : 'PAYABLE',
      };
    });

    return NextResponse.json({ parties: serialized });
  } catch (error: any) {
    console.error('Parties fetch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch parties' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      legalName,
      phone,
      mobile,
      email,
      gstin,
      pan,
      partyType,
      gstRegType,
      stateId,
      city,
      pincode,
      billingAddress,
      shippingAddress,
      creditLimit,
      openingBalance,
      openingBalanceType,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Party name is required' }, { status: 400 });
    }

    const companyId = authContext.company.id;

    const party = await prisma.party.create({
      data: {
        companyId,
        name,
        legalName: legalName || null,
        phone: phone || null,
        mobile: mobile || null,
        email: email || null,
        gstin: gstin || null,
        pan: pan || (gstin ? gstin.substring(2, 12) : null),
        partyType: partyType || 'CUSTOMER',
        gstRegType: gstRegType || 'REGULAR',
        stateId: stateId || null,
        city: city || null,
        pincode: pincode || null,
        billingAddress: billingAddress || null,
        shippingAddress: shippingAddress || null,
        creditLimit: new Decimal(creditLimit || 0).toNumber(),
        openingBalance: new Decimal(openingBalance || 0).toNumber(),
        openingBalanceType: openingBalanceType || 'DEBIT',
      },
    });

    return NextResponse.json({ success: true, party });
  } catch (error: any) {
    console.error('Party creation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create party' }, { status: 400 });
  }
}

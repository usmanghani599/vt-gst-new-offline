import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAuthContext } from '@/lib/auth';
import { hashPassword } from '@/lib/client-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { password, mobile, email } = await req.json();

    const party = await prisma.party.findFirst({
      where: {
        id: resolvedParams.id,
        companyId: auth.company.id,
      },
      include: {
        clientUser: true,
      },
    });

    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    const partyMobile = (mobile || party.mobile)?.trim();
    if (!partyMobile) {
      return NextResponse.json(
        { error: 'A mobile number is required to enable portal access for this party' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password || '123456');

    let clientUser;
    if (party.clientUser) {
      clientUser = await prisma.clientUser.update({
        where: { id: party.clientUser.id },
        data: {
          mobile: partyMobile,
          email: email?.trim() || party.email,
          passwordHash: hashedPassword,
          isActive: true,
        },
      });
    } else {
      clientUser = await prisma.clientUser.create({
        data: {
          companyId: auth.company.id,
          partyId: party.id,
          name: party.name,
          mobile: partyMobile,
          email: email?.trim() || party.email,
          passwordHash: hashedPassword,
          isActive: true,
        },
      });
    }

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/portal/${auth.company.id}/login`;

    return NextResponse.json({
      success: true,
      clientUser: {
        id: clientUser.id,
        mobile: clientUser.mobile,
        name: clientUser.name,
      },
      portalUrl,
      message: 'Portal access enabled successfully',
    });
  } catch (error: any) {
    console.error('Portal access error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update portal access' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import prisma from '@/lib/db';
import Decimal from 'decimal.js';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth?.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const party = await prisma.party.findFirst({
      where: {
        id: resolvedParams.id,
        companyId: auth.company.id,
      },
      include: {
        state: true,
        partyGroup: true,
      },
    });

    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    return NextResponse.json({ party });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch party' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    {
      error: 'Party deletion is disabled to preserve accounting ledger integrity and tax compliance audit trails.',
    },
    { status: 403 }
  );
}

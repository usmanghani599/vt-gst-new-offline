import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth || !auth.company) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    company: auth.company,
  });
}

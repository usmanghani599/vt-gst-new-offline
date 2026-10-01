import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';

export async function GET() {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: authContext.user,
      company: authContext.company,
      financialYear: authContext.financialYear,
      account: authContext.account,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get session' }, { status: 500 });
  }
}

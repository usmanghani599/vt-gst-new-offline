import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { FinancialYearService } from '@/lib/services/financial-year-service';

export async function POST(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company || !authContext.financialYear) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authContext.company.role !== 'OWNER' && authContext.company.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only Company Owners and Admins can close financial years' }, { status: 403 });
    }

    const body = await request.json();
    const { nextFyName, nextFyStartDate, nextFyEndDate } = body;

    if (!nextFyName || !nextFyStartDate || !nextFyEndDate) {
      return NextResponse.json({ error: 'Next FY details are required' }, { status: 400 });
    }

    const result = await FinancialYearService.closeAndRollover({
      companyId: authContext.company.id,
      currentFyId: authContext.financialYear.id,
      userId: authContext.user.id,
      nextFyName,
      nextFyStartDate,
      nextFyEndDate,
    });

    return NextResponse.json({ success: true, rollover: result });
  } catch (error: any) {
    console.error('FY rollover error:', error);
    return NextResponse.json({ error: error.message || 'Financial year rollover failed' }, { status: 400 });
  }
}

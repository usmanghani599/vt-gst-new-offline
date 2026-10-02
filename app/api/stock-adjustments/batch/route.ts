import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { StockService } from '@/lib/services/stock-service';

export async function POST(request: Request) {
  try {
    const authContext = await getAuthContext();
    if (!authContext?.company || !authContext.financialYear) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authContext.financialYear.isClosed) {
      return NextResponse.json({ error: 'Cannot record stock inward in a closed Financial Year' }, { status: 400 });
    }

    const body = await request.json();
    const { items, generalNotes } = body;

    const movements = await StockService.recordBatchStockIn({
      companyId: authContext.company.id,
      financialYearId: authContext.financialYear.id,
      items,
      generalNotes,
    });

    return NextResponse.json({ success: true, count: movements.length, movements });
  } catch (error: any) {
    console.error('Batch stock in error:', error);
    return NextResponse.json({ error: error.message || 'Batch stock in failed' }, { status: 400 });
  }
}

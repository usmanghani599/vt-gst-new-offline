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
      return NextResponse.json({ error: 'Cannot adjust stock in a closed Financial Year' }, { status: 400 });
    }

    const body = await request.json();
    const { itemId, adjustmentType, quantity, notes } = body;

    const result = await StockService.recordAdjustment({
      companyId: authContext.company.id,
      financialYearId: authContext.financialYear.id,
      itemId,
      adjustmentType,
      quantity,
      notes,
    });

    return NextResponse.json({ success: true, movement: result });
  } catch (error: any) {
    console.error('Stock adjustment error:', error);
    return NextResponse.json({ error: error.message || 'Stock adjustment failed' }, { status: 400 });
  }
}

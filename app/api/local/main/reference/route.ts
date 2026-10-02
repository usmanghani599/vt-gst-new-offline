/** Imports platform reference data downloaded at activation (main process only). */
import { NextResponse } from 'next/server';
import { importReferenceData } from '@/lib/desktop-local/sqlite-apply';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json();
  if (!Array.isArray(body.order) || typeof body.data !== 'object') {
    return NextResponse.json({ error: 'Invalid reference data' }, { status: 400 });
  }
  try {
    const counts = importReferenceData(body.order, body.data);
    return NextResponse.json({ success: true, counts });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Import failed' }, { status: 500 });
  }
}

/**
 * Sync control, called only by the Electron main process (x-vtgst-main enforced in middleware).
 * Body: { action: 'run' | 'deep' | 'status' | 'companies' | 'link' | 'unlink', ... }
 */
import { NextResponse } from 'next/server';
import {
  SyncClientError,
  getSyncStatus,
  linkCompany,
  listOnlineCompanies,
  runSync,
  unlinkCompany,
} from '@/lib/desktop-local/sync-client';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    switch (body.action) {
      case 'status':
        return NextResponse.json({ success: true, status: getSyncStatus() });
      case 'run':
        return NextResponse.json({ success: true, status: await runSync() });
      case 'deep':
        return NextResponse.json({ success: true, status: await runSync({ deep: true }) });
      case 'companies':
        return NextResponse.json({ success: true, ...(await listOnlineCompanies(body.email, body.password)) });
      case 'link': {
        const res = await linkCompany({
          email: body.email,
          password: body.password,
          mode: body.mode === 'download' ? 'download' : 'upload',
          companyId: String(body.companyId || ''),
        });
        const status = await runSync();
        return NextResponse.json({ success: true, link: res, status });
      }
      case 'unlink':
        await unlinkCompany();
        return NextResponse.json({ success: true, status: getSyncStatus() });
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (e: any) {
    const status = e instanceof SyncClientError && e.status >= 400 ? e.status : 500;
    return NextResponse.json({ error: e?.message || 'Sync failed', code: e?.code }, { status });
  }
}

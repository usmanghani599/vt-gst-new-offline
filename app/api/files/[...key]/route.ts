/**
 * DESKTOP VERSION (desktop-owned): serves files from encrypted local storage.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { readLocalFile } from '@/lib/s3';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { key: segments = [] } = await params;
  const key = segments.map((k) => decodeURIComponent(k)).join('/');
  if (!key) return NextResponse.json({ error: 'File key is required' }, { status: 400 });

  const file = readLocalFile(key);
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.data.length),
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': 'inline',
    },
  });
}

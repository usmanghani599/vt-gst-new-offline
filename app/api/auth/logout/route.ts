import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('vtgst_session');
  cookieStore.delete('vtgst_active_company');
  cookieStore.delete('vtgst_active_fy');

  return NextResponse.json({ success: true });
}

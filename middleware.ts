/**
 * DESKTOP request guard (Node.js middleware, runs in the embedded server).
 *
 * 1. Only the VTGST desktop window may talk to this server: every request
 *    must carry the per-launch secret that Electron injects. Other programs
 *    or browsers on the same computer get 403.
 * 2. /api/local/main/* additionally requires the main-process secret.
 * 3. The license is re-verified here; when it is not usable the app is locked.
 * 4. Online-only screens (signup, SaaS billing, admin, portal) are redirected.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getRuntime, hasRuntime } from '@/lib/desktop-local/runtime';
import { evaluateLicense, licenseAllowsUse } from '@/lib/desktop-local/license';

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico|app_icon.png).*)'],
};

const ONLINE_ONLY_REDIRECTS: Record<string, string> = {
  '/register': '/desktop/setup',
  '/forgot-password': '/desktop/recover',
  '/reset-password': '/desktop/recover',
  '/subscription': '/desktop/settings',
};

const ALWAYS_ALLOWED_WHEN_LOCKED = ['/desktop/locked', '/api/local/'];

let licenseCache: { at: number; ok: boolean; key: string } | null = null;

function licenseUsable(): boolean {
  const now = Date.now();
  const rt = getRuntime();
  const key = `${rt.license.state}|${rt.license.token || ''}`;
  if (licenseCache && licenseCache.key === key && now - licenseCache.at < 30_000) return licenseCache.ok;
  const { state } = evaluateLicense({
    token: rt.license.token,
    publicKeyPem: rt.licensePublicKey,
    fingerprint: rt.fingerprint,
    devicePublicKeyPem: rt.device.publicKeyPem,
    now,
  });
  // Both the main process' view and our own verification must agree.
  const ok = licenseAllowsUse(state) && licenseAllowsUse(rt.license.state);
  licenseCache = { at: now, ok, key };
  return ok;
}

export function middleware(req: NextRequest) {
  if (!hasRuntime()) return new NextResponse('VTGST desktop runtime missing', { status: 503 });
  const rt = getRuntime();
  const { pathname } = req.nextUrl;

  if (req.headers.get('x-vtgst-internal') !== rt.internalToken) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  if (pathname.startsWith('/api/local/main/') && req.headers.get('x-vtgst-main') !== rt.mainToken) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/portal') || pathname.startsWith('/api/admin') || pathname.startsWith('/api/portal')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  for (const [from, to] of Object.entries(ONLINE_ONLY_REDIRECTS)) {
    if (pathname === from || pathname.startsWith(from + '/')) return NextResponse.redirect(new URL(to, req.url));
  }

  if (!ALWAYS_ALLOWED_WHEN_LOCKED.some((p) => pathname.startsWith(p)) && !licenseUsable()) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'License is not valid on this computer.' }, { status: 402 });
    }
    return NextResponse.redirect(new URL('/desktop/locked', req.url));
  }

  return NextResponse.next();
}

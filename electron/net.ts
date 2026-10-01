import crypto from 'crypto';
import { net } from 'electron';
import { BUILD_CONFIG } from './build-config';
import { vault } from './security/vault';

/** Error returned by the VTGST server (or network). */
export class ServerError extends Error {
  constructor(message: string, public code = 'SERVER_ERROR', public status = 0, public body: any = null) {
    super(message);
  }
}

/** JSON POST using Chromium's network stack (honours system proxy settings). */
export async function postJson<T = any>(path: string, body: unknown, headers: Record<string, string> = {}, timeoutMs = 30_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await net.fetch(BUILD_CONFIG.serverUrl + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
  } catch (e: any) {
    throw new ServerError(e?.name === 'AbortError' ? 'The VTGST server did not respond.' : 'No internet connection.', 'OFFLINE');
  } finally {
    clearTimeout(timer);
  }
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ServerError(json.error || `Server error ${res.status}`, json.code || 'SERVER_ERROR', res.status, json);
  return json as T;
}

/** POST signed with this installation's Ed25519 device key. */
export async function signedPost<T = any>(path: string, body: unknown, timeoutMs = 30_000): Promise<T> {
  const v = vault();
  if (!v.device || !v.license?.activationId) throw new ServerError('This computer is not activated.', 'NOT_ACTIVATED');
  const raw = JSON.stringify(body ?? {});
  const ts = String(Date.now());
  const nonce = crypto.randomBytes(16).toString('hex');
  const msg = ['POST', path, ts, nonce, crypto.createHash('sha256').update(raw).digest('hex')].join('\n');
  const signature = crypto.sign(null, Buffer.from(msg), crypto.createPrivateKey(v.device.privateKeyPem)).toString('base64url');
  return postJson<T>(
    path,
    raw,
    { 'x-vt-activation': v.license.activationId, 'x-vt-timestamp': ts, 'x-vt-nonce': nonce, 'x-vt-signature': signature },
    timeoutMs
  );
}

export async function isOnline(): Promise<boolean> {
  if (!net.isOnline()) return false;
  try {
    const res = await net.fetch(BUILD_CONFIG.serverUrl + '/api/desktop/license/check', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return res.status > 0;
  } catch {
    return false;
  }
}

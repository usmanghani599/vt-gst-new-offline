import crypto from 'crypto';
import type { LicensePayload, LicenseState } from './runtime';

/**
 * Independent license verification inside the embedded server process.
 * The Electron main process verifies too; checking again here means that
 * patching one process is not enough to bypass licensing.
 */

export function licenseAllowsUse(state: LicenseState): boolean {
  return state === 'VALID' || state === 'CHECK_DUE';
}

export function decodeLicenseToken(token: string, publicKeyPem: string): LicensePayload | null {
  try {
    const [prefix, body, sig] = token.split('.');
    if (prefix !== 'VTL1' || !body || !sig) return null;
    const ok = crypto.verify(
      null,
      Buffer.from(`${prefix}.${body}`),
      crypto.createPublicKey(publicKeyPem),
      Buffer.from(sig, 'base64url')
    );
    if (!ok) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as LicensePayload;
    return payload.v === 1 ? payload : null;
  } catch {
    return null;
  }
}

export function fingerprintHash(fingerprint: string): string {
  return crypto.createHash('sha256').update(`vtgst-fp:${fingerprint}`).digest('hex');
}

export function devicePublicKeyHash(publicKeyPem: string): string {
  const der = crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex');
}

/** Pure evaluation of a token against this machine and the current time. */
export function evaluateLicense(opts: {
  token: string | null;
  publicKeyPem: string;
  fingerprint: string;
  devicePublicKeyPem: string | null;
  now: number;
  tampered?: boolean;
}): { state: LicenseState; payload: LicensePayload | null } {
  if (!opts.token) return { state: 'NOT_ACTIVATED', payload: null };
  const payload = decodeLicenseToken(opts.token, opts.publicKeyPem);
  if (!payload) return { state: 'NOT_ACTIVATED', payload: null };
  if (payload.fp !== fingerprintHash(opts.fingerprint)) return { state: 'DEVICE_MISMATCH', payload };
  if (opts.devicePublicKeyPem && payload.dk !== devicePublicKeyHash(opts.devicePublicKeyPem)) {
    return { state: 'DEVICE_MISMATCH', payload };
  }
  if (opts.tampered) return { state: 'TAMPERED', payload };
  // A token issued "in the future" means the clock was moved backwards.
  if (opts.now + 10 * 60 * 1000 < payload.iat) return { state: 'TAMPERED', payload };
  if (payload.exp && opts.now > payload.exp) return { state: 'EXPIRED', payload };
  if (opts.now > payload.chk) return { state: 'CHECK_REQUIRED', payload };
  if (payload.chk - opts.now < 3 * 24 * 60 * 60 * 1000) return { state: 'CHECK_DUE', payload };
  return { state: 'VALID', payload };
}

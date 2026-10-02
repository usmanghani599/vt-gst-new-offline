import crypto from 'crypto';
import { app } from 'electron';
import { BUILD_CONFIG } from '../build-config';
import { getDeviceName, getFingerprint } from '../security/fingerprint';
import { recordEvent, saveVault, updateVault, vault } from '../security/vault';
import { ServerError, postJson, signedPost } from '../net';

/**
 * Desktop license state machine (Electron main process).
 *
 * The server issues an Ed25519-signed token bound to this machine's
 * fingerprint and device key, with a hard "check online before" deadline.
 * The token is verified with the public key compiled into the app, so it
 * cannot be forged, edited, extended or moved to another computer.
 * Clock roll-back is detected with a persisted high-water mark.
 */

export type LicenseState =
  | 'VALID'
  | 'CHECK_DUE'
  | 'CHECK_REQUIRED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'TAMPERED'
  | 'DEVICE_MISMATCH'
  | 'NOT_ACTIVATED';

export interface LicensePayload {
  v: 1;
  lid: string;
  aid: string;
  fp: string;
  dk: string;
  email: string;
  name: string;
  features: string[];
  maxDevices: number;
  exp: number | null;
  iat: number;
  chk: number;
  sync: boolean;
  backup: boolean;
  series: string;
}

const CLOCK_TOLERANCE_MS = 10 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

let tampered = false;
let lastAttempt = 0;
const listeners = new Set<() => void>();

export function onLicenseChange(fn: () => void) {
  listeners.add(fn);
}
function emit() {
  for (const fn of listeners) fn();
}

function publicKeyPem(): string {
  if (!BUILD_CONFIG.licensePublicKey) throw new Error('License public key missing from this build.');
  return BUILD_CONFIG.licensePublicKey;
}

export function decodeToken(token: string): LicensePayload | null {
  try {
    const [prefix, body, sig] = token.split('.');
    if (prefix !== 'VTL1' || !body || !sig) return null;
    const ok = crypto.verify(null, Buffer.from(`${prefix}.${body}`), crypto.createPublicKey(publicKeyPem()), Buffer.from(sig, 'base64url'));
    if (!ok) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as LicensePayload;
    return p.v === 1 ? p : null;
  } catch {
    return null;
  }
}

function fingerprintHash() {
  return crypto.createHash('sha256').update(`vtgst-fp:${getFingerprint()}`).digest('hex');
}

function deviceKeyHash(pem: string) {
  return crypto
    .createHash('sha256')
    .update(crypto.createPublicKey(pem).export({ type: 'spki', format: 'der' }))
    .digest('hex');
}

export function ensureDeviceKeys() {
  const v = vault();
  if (v.device) return v.device;
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const device = {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
  updateVault({ device });
  return device;
}

// ---------------------------------------------------------------------------
// Clock tamper detection
// ---------------------------------------------------------------------------

let lastPersist = 0;
export function checkClock(): boolean {
  const v = vault();
  const now = Date.now();
  if (now + CLOCK_TOLERANCE_MS < v.clockHighWater) {
    if (!tampered) {
      tampered = true;
      recordEvent('CLOCK_ROLLBACK', { now, highWater: v.clockHighWater });
      emit();
    }
    return false;
  }
  if (now > v.clockHighWater) {
    v.clockHighWater = now;
    if (now - lastPersist > 10 * 60 * 1000) {
      lastPersist = now;
      saveVault();
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export function evaluate(): { state: LicenseState; payload: LicensePayload | null } {
  const v = vault();
  if (!v.license?.token) return { state: 'NOT_ACTIVATED', payload: null };
  const payload = decodeToken(v.license.token);
  if (!payload) return { state: 'NOT_ACTIVATED', payload: null };
  if (payload.fp !== fingerprintHash()) return { state: 'DEVICE_MISMATCH', payload };
  if (!v.device || payload.dk !== deviceKeyHash(v.device.publicKeyPem)) return { state: 'DEVICE_MISMATCH', payload };
  const blocked = v.license.blocked;
  if (blocked) return { state: blocked.code === 'LICENSE_EXPIRED' ? 'EXPIRED' : blocked.code === 'DEVICE_MISMATCH' ? 'DEVICE_MISMATCH' : 'REVOKED', payload };
  const now = Date.now();
  if (tampered || now + CLOCK_TOLERANCE_MS < payload.iat) return { state: 'TAMPERED', payload };
  if (payload.exp && now > payload.exp) return { state: 'EXPIRED', payload };
  if (now > payload.chk) return { state: 'CHECK_REQUIRED', payload };
  if (payload.chk - now < 3 * DAY) return { state: 'CHECK_DUE', payload };
  return { state: 'VALID', payload };
}

export function isUsable(state: LicenseState) {
  return state === 'VALID' || state === 'CHECK_DUE';
}

const MESSAGES: Record<LicenseState, string> = {
  VALID: 'License is active on this computer.',
  CHECK_DUE: 'Please connect to the internet soon so the license can be re-verified.',
  CHECK_REQUIRED: 'This computer has been offline too long. Connect to the internet and click “Verify online now”.',
  EXPIRED: 'Your license has expired. Please renew it to continue.',
  REVOKED: 'This license is no longer active. Please contact VTGST support.',
  TAMPERED: 'The computer date/time looks wrong. Set the correct date and time, then verify online.',
  DEVICE_MISMATCH: 'This license belongs to a different computer. Please activate this computer.',
  NOT_ACTIVATED: 'This computer is not activated yet.',
};

export function licenseInfo() {
  const v = vault();
  const { state, payload } = evaluate();
  const key = v.license?.licenseKey || null;
  return {
    state,
    message: v.license?.blocked?.message || MESSAGES[state],
    licenseKeyMasked: key ? `${key.slice(0, 9)}••••-••••-${key.slice(-5)}` : null,
    customer: payload?.name || null,
    email: payload?.email || v.license?.email || null,
    expiresAt: payload?.exp || null,
    nextCheckBy: payload?.chk || null,
    lastCheckAt: v.license?.lastCheckAt || null,
    features: payload?.features || [],
    allowSync: Boolean(payload?.sync),
    allowBackup: Boolean(payload?.backup),
    deviceName: getDeviceName(),
  };
}

// ---------------------------------------------------------------------------
// Server calls
// ---------------------------------------------------------------------------

export interface ActivationResult {
  backupSecret: string;
  linkedCompanyId: string | null;
}

export async function activate(licenseKey: string, email: string): Promise<ActivationResult> {
  const device = ensureDeviceKeys();
  const key = licenseKey.trim().toUpperCase().replace(/\s+/g, '');
  const fingerprint = getFingerprint();
  const timestamp = Date.now();
  const proof = crypto
    .sign(null, Buffer.from(`ACTIVATE\n${key}\n${fingerprint}\n${timestamp}`), crypto.createPrivateKey(device.privateKeyPem))
    .toString('base64url');

  const res = await postJson<{ token: string; activationId: string; backupSecret: string; serverTime: number; linkedCompanyId: string | null }>(
    '/api/desktop/license/activate',
    {
      licenseKey: key,
      email: email.trim().toLowerCase(),
      fingerprint,
      deviceName: getDeviceName(),
      platform: `${process.platform}-${process.arch}`,
      appVersion: app.getVersion(),
      devicePublicKey: device.publicKeyPem,
      timestamp,
      proof,
    }
  );
  if (!decodeToken(res.token)) throw new Error('The server returned an invalid license. Please update the app.');

  const v = vault();
  // A new license on a machine that already had a different one keeps the old backup key unusable on purpose.
  const sameLicense = v.license?.licenseKey === key;
  v.license = {
    licenseKey: key,
    email: email.trim().toLowerCase(),
    activationId: res.activationId,
    token: res.token,
    lastCheckAt: Date.now(),
    lastServerTime: res.serverTime,
  };
  if (!sameLicense) {
    v.backupKey = undefined;
    v.backupKeyCheck = undefined;
  }
  v.backupSecret = res.backupSecret;
  v.clockHighWater = Math.max(res.serverTime, Date.now());
  tampered = false;
  saveVault();
  emit();
  return { backupSecret: res.backupSecret, linkedCompanyId: res.linkedCompanyId };
}

export async function fetchReferenceData() {
  return signedPost<{ order: string[]; data: Record<string, unknown[]> }>('/api/desktop/reference-data', {}, 60_000);
}

/** Online check-in. Returns the new state. Throws ServerError('OFFLINE') without internet. */
export async function checkOnline() {
  const v = vault();
  if (!v.license) return evaluate();
  const events = v.pendingEvents || [];
  const res = await signedPost<{ status: string; message?: string; token?: string; serverTime: number }>('/api/desktop/license/check', {
    fingerprint: getFingerprint(),
    appVersion: app.getVersion(),
    events,
  }).catch((e: ServerError) => {
    if (e.code === 'CLOCK_SKEW') {
      tampered = true;
      emit();
    }
    if (['DEVICE_DEACTIVATED', 'DEVICE_BLOCKED', 'UNKNOWN_DEVICE', 'LICENSE_REVOKED'].includes(e.code) && v.license) {
      v.license.blocked = { code: e.code, message: e.message };
      saveVault();
      emit();
    }
    throw e;
  });

  v.pendingEvents = [];
  v.license.lastCheckAt = Date.now();
  v.license.lastServerTime = res.serverTime;
  if (Math.abs(res.serverTime - Date.now()) > CLOCK_TOLERANCE_MS) {
    tampered = true;
  } else {
    tampered = false;
    v.clockHighWater = Math.max(res.serverTime, Date.now());
  }

  if (res.status === 'OK' && res.token && decodeToken(res.token)) {
    v.license.token = res.token;
    v.license.blocked = null;
  } else if (res.status !== 'OK') {
    v.license.blocked = { code: res.status, message: res.message || null };
    recordEvent('LICENSE_BLOCKED', { status: res.status });
  }
  saveVault();
  emit();
  return evaluate();
}

export async function deactivate() {
  await signedPost('/api/desktop/license/deactivate', {});
  const v = vault();
  if (v.license) v.license.token = '';
  saveVault();
  emit();
}

let timer: NodeJS.Timeout | null = null;
export function startLicenseWatch() {
  if (timer) return;
  const tick = async () => {
    checkClock();
    const v = vault();
    const { state } = evaluate();
    const last = v.license?.lastCheckAt || 0;
    const now = Date.now();
    const due = (state !== 'VALID' && now - lastAttempt > 5 * 60 * 1000) || now - last > 6 * 60 * 60 * 1000;
    if (v.license && due && !['NOT_ACTIVATED'].includes(state)) {
      lastAttempt = now;
      try {
        await checkOnline();
      } catch {
        /* offline: try again later */
      }
    }
  };
  checkClock();
  tick();
  timer = setInterval(tick, 60 * 1000);
}

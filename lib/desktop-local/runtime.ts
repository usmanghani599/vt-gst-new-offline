/**
 * Runtime configuration handed to the embedded Next.js server by the Electron
 * main process (see desktop-server/server-entry.js). Secrets live only in
 * memory of this process; they are never written to env or disk.
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

export interface DesktopRuntime {
  appVersion: string;
  dataDir: string;
  dbPath: string;
  filesDir: string;
  /** hex key for the encrypted database (also consumed by the cipher shim) */
  dbKey: string;
  /** random per-launch secret: the renderer must send it on every request */
  internalToken: string;
  /** random per-launch secret known only to the Electron main process */
  mainToken: string;
  /** random per-install secret used to sign local session cookies */
  sessionSecret: string;
  /** Ed25519 public key (PEM) of the licensing server */
  licensePublicKey: string;
  /** raw machine fingerprint (hex) */
  fingerprint: string;
  license: { token: string | null; state: LicenseState; payload: LicensePayload | null; licenseKey: string | null };
  device: { activationId: string | null; privateKeyPem: string | null; publicKeyPem: string | null };
  sync: { serverUrl: string; linkedCompanyId: string | null; seriesCode: string | null };
}

const KEY = '__VTGST_DESKTOP__';

export function getRuntime(): DesktopRuntime {
  const rt = (globalThis as any)[KEY] as DesktopRuntime | undefined;
  if (!rt) throw new Error('VTGST desktop runtime is not initialised (start the app through Electron).');
  return rt;
}

export function hasRuntime(): boolean {
  return Boolean((globalThis as any)[KEY]);
}

export function updateRuntime(patch: Partial<DesktopRuntime>) {
  const rt = getRuntime();
  Object.assign(rt, patch);
}

/** Device numbering code, only once this computer is linked to online sync. */
export function getDeviceSeriesCode(): string | null {
  if (!hasRuntime()) return null;
  const { sync } = getRuntime();
  return sync.linkedCompanyId && sync.seriesCode ? sync.seriesCode : null;
}

/** Prefix that keeps receipt/payment numbers unique across synced computers. */
export function deviceNumberTag(): string {
  const code = getDeviceSeriesCode();
  return code ? `${code}-` : '';
}

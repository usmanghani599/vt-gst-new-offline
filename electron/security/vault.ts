import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app, safeStorage } from 'electron';
import { getFingerprint } from './fingerprint';

/**
 * Encrypted local vault for the app's secrets (database key seed, device key
 * pair, license token, backup key, Google refresh token, clock watermark…).
 *
 * Two layers:
 *  1. AES-256-GCM with a key derived from this machine's fingerprint, so a
 *     copied vault is useless on any other computer.
 *  2. The OS keystore (Windows DPAPI / macOS Keychain / libsecret) via
 *     Electron safeStorage, tying it to the logged-in OS user as well.
 * Writes are atomic (temp file + rename) and a second copy is kept so a
 * crash during write can never lose the database key.
 */

export interface VaultData {
  version: 1;
  /** random 32 bytes (hex); the DB key is derived from it + fingerprint */
  dbKeySeed: string;
  /** random 32 bytes (hex) used to sign local login sessions */
  sessionSecret: string;
  device?: { privateKeyPem: string; publicKeyPem: string };
  license?: {
    licenseKey: string;
    email: string;
    activationId: string;
    token: string;
    lastCheckAt: number | null;
    lastServerTime: number | null;
    /** set when the server reported the license/device as blocked; survives restarts */
    blocked?: { code: string; message: string | null } | null;
  };
  /** per-license secret from the server; required to open backups */
  backupSecret?: string;
  /** scrypt(password) ⊕ backupSecret derived master key (hex) */
  backupKey?: string;
  backupKeyCheck?: string;
  google?: { email: string; refreshToken: string };
  backupSettings?: { enabled: boolean; hours: number; keep: number; localFolder: string | null };
  lastBackupAt?: string | null;
  lastBackupError?: string | null;
  print?: { silent: boolean; documentPrinter: string; receiptPrinter: string; receiptWidthMm: 58 | 80; copies: number };
  /** highest wall-clock time ever observed (ms) – detects clock roll-back */
  clockHighWater: number;
  /** tamper events to report at next online check */
  pendingEvents: { event: string; details?: unknown; at: number }[];
}

const MAGIC = Buffer.from('VTV1');

function vaultPaths() {
  const dir = app.getPath('userData');
  return [path.join(dir, 'vault.dat'), path.join(dir, 'vault.bak')];
}

function machineKey(): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(getFingerprint(), 'hex'), Buffer.from('vtgst-vault'), Buffer.from('vault-v1'), 32));
}

function seal(json: string): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', machineKey(), iv);
  const inner = Buffer.concat([iv, c.update(json, 'utf8'), c.final(), c.getAuthTag()]);
  const outer = safeStorage.isEncryptionAvailable() ? Buffer.concat([Buffer.from([1]), safeStorage.encryptString(inner.toString('base64'))]) : Buffer.concat([Buffer.from([0]), inner]);
  return Buffer.concat([MAGIC, outer]);
}

function unseal(buf: Buffer): string {
  if (!buf.subarray(0, 4).equals(MAGIC)) throw new Error('bad vault');
  const mode = buf[4];
  let inner = buf.subarray(5);
  if (mode === 1) inner = Buffer.from(safeStorage.decryptString(inner), 'base64');
  const iv = inner.subarray(0, 12);
  const tag = inner.subarray(inner.length - 16);
  const d = crypto.createDecipheriv('aes-256-gcm', machineKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(inner.subarray(12, inner.length - 16)), d.final()]).toString('utf8');
}

let data: VaultData | null = null;

export type VaultLoadResult = 'loaded' | 'created' | 'foreign';

/**
 * Loads the vault. Returns 'foreign' when a vault exists but cannot be opened
 * on this machine (copied installation / changed hardware) — the caller must
 * then refuse to open the database.
 */
export function loadVault(): VaultLoadResult {
  const [main, backup] = vaultPaths();
  const existing = [main, backup].filter((p) => fs.existsSync(p));
  for (const p of existing) {
    try {
      data = JSON.parse(unseal(fs.readFileSync(p))) as VaultData;
      return 'loaded';
    } catch {
      /* try next copy */
    }
  }
  if (existing.length) return 'foreign';
  data = {
    version: 1,
    dbKeySeed: crypto.randomBytes(32).toString('hex'),
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    clockHighWater: Date.now(),
    pendingEvents: [],
  };
  saveVault();
  return 'created';
}

export function vault(): VaultData {
  if (!data) throw new Error('Vault not loaded');
  return data;
}

export function updateVault(patch: Partial<VaultData>) {
  Object.assign(vault(), patch);
  saveVault();
}

export function saveVault() {
  const [main, backup] = vaultPaths();
  const sealed = seal(JSON.stringify(vault()));
  fs.mkdirSync(path.dirname(main), { recursive: true });
  for (const target of [main, backup]) {
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, sealed, { mode: 0o600 });
    fs.renameSync(tmp, target);
  }
}

/** Key of the encrypted SQLite database (hex). Changes if the vault moves to another machine. */
export function databaseKey(): string {
  const v = vault();
  return Buffer.from(
    crypto.hkdfSync('sha256', Buffer.from(v.dbKeySeed, 'hex'), Buffer.from(getFingerprint(), 'hex'), Buffer.from('vtgst-db-v1'), 32)
  ).toString('hex');
}

export function recordEvent(event: string, details?: unknown) {
  const v = vault();
  v.pendingEvents = [...(v.pendingEvents || []), { event, details, at: Date.now() }].slice(-20);
  saveVault();
}

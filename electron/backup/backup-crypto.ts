import crypto from 'crypto';
import zlib from 'zlib';

/**
 * VTGST encrypted backup format (.vtgbak)
 *
 *   "VTGSTBK1" | u32 headerLength | header JSON | AES-256-GCM ciphertext | 16-byte tag
 *
 * - Content: gzip of the SQLite database image.
 * - Key: HKDF(masterKey, per-file random salt). The header (incl. salt/iv)
 *   is authenticated as AAD, so any modified byte makes the file unreadable.
 * - masterKey = HKDF(scrypt(password, N=2^17) || licenseBackupSecret).
 *   The license backup secret is only released by the VTGST server to an
 *   activated computer of the same license. Without BOTH the password and an
 *   activated license, the file cannot be decrypted; brute force is infeasible
 *   (256-bit AES key, memory-hard scrypt on the password part).
 */

const MAGIC = Buffer.from('VTGSTBK1');
const SCRYPT = { N: 1 << 17, r: 8, p: 1, maxmem: 512 * 1024 * 1024 };

export interface BackupHeader {
  v: 1;
  alg: 'AES-256-GCM';
  kdf: 'scrypt-hkdf-v1';
  createdAt: string;
  appVersion: string;
  device: string;
  salt: string;
  iv: string;
  /** short key-check value so a wrong password gives a clear message */
  kc: string;
}

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password.normalize('NFKC'), salt, 32, SCRYPT, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

/** Deterministic per license + password, so a new computer can rebuild it after activation. */
export async function deriveMasterKey(password: string, backupSecretHex: string): Promise<Buffer> {
  const secret = Buffer.from(backupSecretHex, 'hex');
  if (secret.length !== 32) throw new Error('License backup secret missing. Verify the license online first.');
  const salt = crypto.createHash('sha256').update('vtgst-backup-salt|').update(secret).digest();
  const pw = await scryptAsync(password, salt);
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.concat([pw, secret]), Buffer.from('vtgst-backup'), Buffer.from('master-v1'), 32));
}

export function keyCheck(master: Buffer): string {
  return crypto.createHmac('sha256', master).update('vtgst-backup-key-check').digest('hex').slice(0, 16);
}

function fileKey(master: Buffer, salt: Buffer): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', master, salt, Buffer.from('file-v1'), 32));
}

export function encryptBackup(plainDb: Buffer, master: Buffer, meta: { appVersion: string; device: string }): Buffer {
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const header: BackupHeader = {
    v: 1,
    alg: 'AES-256-GCM',
    kdf: 'scrypt-hkdf-v1',
    createdAt: new Date().toISOString(),
    appVersion: meta.appVersion,
    device: meta.device,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    kc: keyCheck(master),
  };
  const headerBuf = Buffer.from(JSON.stringify(header), 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(headerBuf.length);
  const aad = Buffer.concat([MAGIC, len, headerBuf]);

  const cipher = crypto.createCipheriv('aes-256-gcm', fileKey(master, salt), iv);
  cipher.setAAD(aad);
  const enc = Buffer.concat([cipher.update(zlib.gzipSync(plainDb, { level: 6 })), cipher.final()]);
  return Buffer.concat([aad, enc, cipher.getAuthTag()]);
}

export function readBackupHeader(file: Buffer): BackupHeader {
  if (file.length < 32 || !file.subarray(0, 8).equals(MAGIC)) throw new Error('This is not a VTGST backup file.');
  const len = file.readUInt32BE(8);
  if (len > 64 * 1024) throw new Error('Corrupted backup header.');
  const header = JSON.parse(file.subarray(12, 12 + len).toString('utf8')) as BackupHeader;
  if (header.v !== 1 || header.alg !== 'AES-256-GCM') throw new Error('Unsupported backup version. Please update the app.');
  return header;
}

export function decryptBackup(file: Buffer, master: Buffer): Buffer {
  const header = readBackupHeader(file);
  if (header.kc !== keyCheck(master)) {
    throw new Error('Wrong backup password, or the backup belongs to a different license.');
  }
  const len = file.readUInt32BE(8);
  const aad = file.subarray(0, 12 + len);
  const tag = file.subarray(file.length - 16);
  const body = file.subarray(12 + len, file.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', fileKey(master, Buffer.from(header.salt, 'base64')), Buffer.from(header.iv, 'base64'));
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  let gz: Buffer;
  try {
    gz = Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw new Error('The backup file is damaged or was modified.');
  }
  return zlib.gunzipSync(gz);
}

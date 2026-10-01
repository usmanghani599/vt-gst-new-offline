/**
 * DESKTOP VERSION (desktop-owned; not overwritten by sync-upstream).
 *
 * Same exports as the online Amazon S3 helper, but files are stored on this
 * computer only, each one AES-256-GCM encrypted with a key derived from the
 * database key. Nothing leaves the machine.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getRuntime } from './desktop-local/runtime';

const MAGIC = Buffer.from('VTF1');

function filesKey(): Buffer {
  const rt = getRuntime();
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(rt.dbKey, 'hex'), Buffer.from('vtgst-files'), Buffer.from('files-v1'), 32));
}

function safePath(key: string): string {
  const clean = String(key || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p && p !== '.' && p !== '..')
    .join('/');
  if (!clean) throw new Error('Invalid file key');
  const root = getRuntime().filesDir;
  const full = path.join(root, clean + '.vtf');
  if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error('Invalid file key');
  return full;
}

export function getS3Config() {
  return {
    region: 'This computer',
    accessKeyId: '',
    secretAccessKey: '',
    bucketName: 'Encrypted local storage',
    customDomain: '',
    isConfigured: true,
  };
}

/** No S3 client on desktop. */
export function getS3Client(): null {
  return null;
}

export function formatS3FileUrl(key: string): string {
  return `/api/files/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function uploadToS3Bucket(
  buffer: Buffer | Uint8Array,
  key: string,
  contentType: string
): Promise<{ fileUrl: string; s3Key: string; isS3: boolean }> {
  const file = safePath(key);
  const meta = Buffer.from(JSON.stringify({ contentType, size: buffer.length, at: Date.now() }));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', filesKey(), iv);
  cipher.setAAD(Buffer.from(key));
  const metaLen = Buffer.alloc(4);
  metaLen.writeUInt32BE(meta.length);
  const enc = Buffer.concat([cipher.update(Buffer.concat([metaLen, meta, Buffer.from(buffer)])), cipher.final()]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([MAGIC, iv, cipher.getAuthTag(), enc]));
  return { fileUrl: formatS3FileUrl(key), s3Key: key, isS3: false };
}

/** Reads and decrypts a stored file. Returns null when missing or tampered. */
export function readLocalFile(key: string): { data: Buffer; contentType: string } | null {
  let file: string;
  try {
    file = safePath(key);
  } catch {
    return null;
  }
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file);
    if (!raw.subarray(0, 4).equals(MAGIC)) return null;
    const iv = raw.subarray(4, 16);
    const tag = raw.subarray(16, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', filesKey(), iv);
    decipher.setAAD(Buffer.from(key));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(raw.subarray(32)), decipher.final()]);
    const metaLen = plain.readUInt32BE(0);
    const meta = JSON.parse(plain.subarray(4, 4 + metaLen).toString('utf8'));
    return { data: plain.subarray(4 + metaLen), contentType: meta.contentType || 'application/octet-stream' };
  } catch {
    return null;
  }
}

export async function deleteFromS3Bucket(key: string): Promise<boolean> {
  try {
    fs.unlinkSync(safePath(key));
    return true;
  } catch {
    return false;
  }
}

export async function listS3BucketFiles(prefix = '', maxKeys = 100) {
  const root = getRuntime().filesDir;
  const out: { key: string; size: number; lastModified: Date; fileUrl: string; etag?: string }[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir) || out.length >= maxKeys) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name.endsWith('.vtf')) {
        const key = path.relative(root, full).split(path.sep).join('/').replace(/\.vtf$/, '');
        if (key.startsWith(prefix)) out.push({ key, size: st.size, lastModified: st.mtime, fileUrl: formatS3FileUrl(key) });
      }
      if (out.length >= maxKeys) return;
    }
  };
  walk(root);
  return out;
}

export async function testS3Connection() {
  const started = Date.now();
  const root = getRuntime().filesDir;
  fs.mkdirSync(root, { recursive: true });
  return {
    success: true,
    message: 'Files are stored encrypted on this computer.',
    latencyMs: Date.now() - started,
    config: { region: 'This computer', bucketName: 'Encrypted local storage', customDomain: '', isConfigured: true },
  };
}

export async function getPresignedUploadUrl(companyId: string, fileName: string, _contentType: string) {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const s3Key = `tenants/${companyId}/orders/${Date.now()}-${sanitizedFileName}`;
  return {
    uploadUrl: `/api/upload?key=${encodeURIComponent(s3Key)}&companyId=${encodeURIComponent(companyId)}`,
    fileUrl: formatS3FileUrl(s3Key),
    r2Key: s3Key,
    s3Key,
  };
}

export async function getPresignedReadUrl(s3Key: string): Promise<string> {
  return formatS3FileUrl(s3Key);
}

export const uploadToR2Bucket = async (buffer: Buffer | Uint8Array, key: string, contentType: string) => {
  const res = await uploadToS3Bucket(buffer, key, contentType);
  return { fileUrl: res.fileUrl, r2Key: res.s3Key, isR2: res.isS3 };
};
export const deleteFromR2Bucket = deleteFromS3Bucket;
export const listR2BucketFiles = listS3BucketFiles;
export const testR2Connection = testS3Connection;
export const formatR2FileUrl = formatS3FileUrl;
export const getR2Config = getS3Config;
export const getR2Client = getS3Client;

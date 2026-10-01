import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { BUILD_CONFIG } from '../build-config';

/**
 * Verifies that the embedded server (which lives outside app.asar) has not
 * been modified. The manifest lists the SHA-256 of every code file; the hash
 * of the manifest itself is compiled into this (asar-protected) main process.
 */
export function verifyServerIntegrity(serverDir: string): { ok: boolean; reason?: string } {
  const manifestPath = path.join(serverDir, 'server-manifest.json');
  if (!BUILD_CONFIG.serverManifestHash) return { ok: false, reason: 'This build has no integrity manifest.' };
  if (!fs.existsSync(manifestPath)) return { ok: false, reason: 'Integrity manifest missing.' };

  const raw = fs.readFileSync(manifestPath);
  if (crypto.createHash('sha256').update(raw).digest('hex') !== BUILD_CONFIG.serverManifestHash) {
    return { ok: false, reason: 'Integrity manifest was modified.' };
  }
  const manifest = JSON.parse(raw.toString('utf8')) as { files: Record<string, string> };
  for (const [rel, expected] of Object.entries(manifest.files)) {
    const full = path.join(serverDir, rel);
    if (!fs.existsSync(full)) return { ok: false, reason: `Missing file: ${rel}` };
    const actual = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
    if (actual !== expected) return { ok: false, reason: `Modified file: ${rel}` };
  }
  return { ok: true };
}

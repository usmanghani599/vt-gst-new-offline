import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { BUILD_CONFIG } from '../build-config';

/**
 * The local server ships as one archive (resources/server.asar). On first start
 * after an install/update it is unpacked into the user's app-data folder.
 * Electron's `fs` reads inside .asar archives transparently. Unpacking is
 * atomic (temp folder + rename) and old versions are removed. The unpacked
 * files are verified against the integrity manifest on every start.
 */

const MARKER = '.vtgst-unpacked';

function runtimeRoot() {
  return path.join(app.getPath('userData'), 'rt');
}

export function packPath() {
  return path.join(process.resourcesPath, 'server.asar');
}

export function unpackedServerDir() {
  return path.join(runtimeRoot(), BUILD_CONFIG.buildId);
}

export function needsUnpack(): boolean {
  const marker = path.join(unpackedServerDir(), MARKER);
  return !fs.existsSync(marker) || fs.readFileSync(marker, 'utf8').trim() !== BUILD_CONFIG.serverPackHash;
}

function copyOut(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyOut(from, to);
    else fs.writeFileSync(to, fs.readFileSync(from));
  }
}

/** Forces a fresh unpack on next unpackServer() (used to self-heal a damaged copy). */
export function invalidateUnpacked() {
  fs.rmSync(path.join(unpackedServerDir(), MARKER), { force: true });
}

export function unpackServer(): string {
  const dir = unpackedServerDir();
  if (!needsUnpack()) return dir;

  const pack = packPath();
  if (!fs.existsSync(pack)) throw new Error(`Missing file: ${pack}`);
  // Check the archive itself before trusting it (read as a plain file).
  const originalFs: typeof fs = require('original-fs');
  const hash = crypto.createHash('sha256').update(originalFs.readFileSync(pack)).digest('hex');
  if (hash !== BUILD_CONFIG.serverPackHash) throw new Error('server.asar was modified or is incomplete');

  const root = runtimeRoot();
  fs.mkdirSync(root, { recursive: true });
  const tmp = path.join(root, `.tmp-${process.pid}-${Date.now()}`);
  try {
    copyOut(pack, tmp);
    fs.writeFileSync(path.join(tmp, MARKER), BUILD_CONFIG.serverPackHash);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(tmp, dir);
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }

  // Remove older versions and leftovers.
  for (const name of fs.readdirSync(root)) {
    if (name !== BUILD_CONFIG.buildId) fs.rmSync(path.join(root, name), { recursive: true, force: true });
  }
  return dir;
}

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { BUILD_CONFIG } from '../build-config';

/**
 * The local server ships as one archive (resources/server.pack, asar format).
 * On first start after an install/update it is unpacked into the user's
 * app-data folder. It is deliberately NOT named *.asar: with the embedded asar
 * integrity fuse on, Electron (Windows/macOS) aborts the process when it opens
 * an .asar file that is not listed in the app's integrity resource. The archive
 * is read here with a small asar reader instead. Unpacking is atomic (temp
 * folder + rename) and old versions are removed. The unpacked files are
 * verified against the integrity manifest on every start.
 */

const MARKER = '.vtgst-unpacked';

interface AsarEntry {
  files?: Record<string, AsarEntry>;
  size?: number;
  offset?: string;
  unpacked?: boolean;
  link?: string;
}

function runtimeRoot() {
  return path.join(app.getPath('userData'), 'rt');
}

export function packPath() {
  return path.join(process.resourcesPath, 'server.pack');
}

export function unpackedServerDir() {
  return path.join(runtimeRoot(), BUILD_CONFIG.buildId);
}

export function needsUnpack(): boolean {
  const marker = path.join(unpackedServerDir(), MARKER);
  return !fs.existsSync(marker) || fs.readFileSync(marker, 'utf8').trim() !== BUILD_CONFIG.serverPackHash;
}

/** Extracts an asar archive held in memory (format: pickled JSON header + concatenated file data). */
function extractAsar(archive: Buffer, dest: string) {
  const headerSize = archive.readUInt32LE(4);
  const jsonSize = archive.readUInt32LE(12);
  const header = JSON.parse(archive.subarray(16, 16 + jsonSize).toString('utf8')) as AsarEntry;
  const base = 8 + headerSize;
  const root = path.resolve(dest);

  const walk = (node: AsarEntry, dir: string) => {
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, entry] of Object.entries(node.files || {})) {
      const target = path.resolve(dir, name);
      if (!target.startsWith(root + path.sep)) throw new Error(`Invalid path in server archive: ${name}`);
      if (entry.files) walk(entry, target);
      else if (entry.link || entry.unpacked) throw new Error(`Unsupported entry in server archive: ${name}`);
      else {
        const start = base + Number(entry.offset);
        fs.writeFileSync(target, archive.subarray(start, start + Number(entry.size)));
      }
    }
  };
  walk(header, root);
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
  const archive = fs.readFileSync(pack);
  if (crypto.createHash('sha256').update(archive).digest('hex') !== BUILD_CONFIG.serverPackHash) {
    throw new Error('server.pack was modified or is incomplete');
  }

  const root = runtimeRoot();
  fs.mkdirSync(root, { recursive: true });
  const tmp = path.join(root, `.tmp-${process.pid}-${Date.now()}`);
  try {
    extractAsar(archive, tmp);
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

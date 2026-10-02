#!/usr/bin/env node
/**
 * Assembles build/server — the self-contained local server shipped next to the
 * Electron app (resources/server):
 *   .next/standalone + static assets + public + migrations + server-entry.js
 * and writes the integrity manifest whose hash is compiled into the main process.
 *
 *   node scripts/prepare-bundle.mjs
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const OUT = path.join(ROOT, 'build', 'server');
const STANDALONE = path.join(ROOT, '.next', 'standalone');

if (!fs.existsSync(path.join(STANDALONE, 'server.js'))) {
  console.error('Run `npm run build:web` first (.next/standalone missing).');
  process.exit(1);
}

const cp = (from, to) => fs.cpSync(from, to, { recursive: true, dereference: true, force: true });

fs.rmSync(OUT, { recursive: true, force: true });
cp(STANDALONE, OUT);
cp(path.join(ROOT, '.next', 'static'), path.join(OUT, '.next', 'static'));
cp(path.join(ROOT, 'public'), path.join(OUT, 'public'));
cp(path.join(ROOT, 'migrations'), path.join(OUT, 'migrations'));
fs.copyFileSync(path.join(ROOT, 'desktop-server', 'server-entry.js'), path.join(OUT, 'server-entry.js'));
for (const junk of ['.env', '.env.local', 'prisma/upstream.schema.prisma']) fs.rmSync(path.join(OUT, junk), { force: true });

// Runtime packages loaded outside the webpack bundle (+ their dependency closure).
const RUNTIME_PACKAGES = ['better-sqlite3', 'better-sqlite3-multiple-ciphers', '@prisma/client', '@prisma/adapter-better-sqlite3', '.prisma'];
const copied = new Set();
function copyPackage(name, fromDir = ROOT) {
  if (copied.has(name)) return;
  let pkgDir;
  try {
    pkgDir = path.dirname(require.resolve(`${name}/package.json`, { paths: [fromDir] }));
  } catch {
    const direct = path.join(ROOT, 'node_modules', name);
    if (!fs.existsSync(direct)) throw new Error(`Runtime package not found: ${name}`);
    pkgDir = direct;
  }
  copied.add(name);
  cp(pkgDir, path.join(OUT, 'node_modules', name));
  const pkgJson = path.join(pkgDir, 'package.json');
  if (fs.existsSync(pkgJson)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
    for (const dep of Object.keys(pkg.dependencies || {})) copyPackage(dep, pkgDir);
  }
}
for (const p of RUNTIME_PACKAGES) copyPackage(p);

// Keep only the Prisma query engine of the platform being packaged (each is ~20 MB).
const enginePlatform = { win32: 'windows', darwin: process.arch === 'arm64' ? 'darwin-arm64' : 'darwin', linux: 'debian' }[process.platform];
for (const dir of [path.join(OUT, 'node_modules', '.prisma', 'client'), path.join(OUT, 'node_modules', '@prisma', 'client')]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (/query_engine/.test(f) && !f.includes(enginePlatform) && !(enginePlatform === 'darwin' && f.includes('darwin.'))) {
      fs.rmSync(path.join(dir, f), { force: true });
    }
  }
}

// better-sqlite3-multiple-ciphers is an N-API addon and ships prebuilt binaries for
// win32/darwin/linux inside the package, so it loads in Electron without a rebuild.
const prebuilt = path.join(OUT, 'node_modules', 'better-sqlite3-multiple-ciphers', 'prebuilds');
if (!fs.existsSync(prebuilt)) throw new Error('better-sqlite3-multiple-ciphers prebuilds missing');

// Integrity manifest
const HASHED = /\.(js|cjs|mjs|json|node|sql|html)$/;
const files = {};
(function walk(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const st = fs.lstatSync(full);
    if (st.isDirectory()) walk(full);
    else if (HASHED.test(name) && name !== 'server-manifest.json') {
      files[path.relative(OUT, full).split(path.sep).join('/')] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
    }
  }
})(OUT);
const manifest = Buffer.from(JSON.stringify({ v: 1, createdAt: new Date().toISOString(), files }));
fs.writeFileSync(path.join(OUT, 'server-manifest.json'), manifest);
fs.writeFileSync(path.join(ROOT, 'build', 'server-manifest.sha256'), crypto.createHash('sha256').update(manifest).digest('hex'));
console.log(`build/server ready: ${Object.keys(files).length} files in integrity manifest.`);

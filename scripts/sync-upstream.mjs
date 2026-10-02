#!/usr/bin/env node
/**
 * Pulls the UI / business logic from the online app (vtgstnew) into this
 * desktop app, so both stay visually and functionally identical.
 *
 *   node scripts/sync-upstream.mjs ../vtgstnew
 *
 * - Online-only areas (super admin, client portal, SaaS billing, signup,
 *   email password reset, server-side desktop APIs) are skipped.
 * - Files the desktop replaces completely (DESKTOP_OWNED) are never overwritten.
 * - Small desktop modifications are re-applied as string patches
 *   (scripts/desktop-patches.mjs). A patch that no longer matches is reported
 *   so it can be updated by hand.
 * - Afterwards run: npm run schema   (regenerates the SQLite schema + migration)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PATCHES } from './desktop-patches.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(process.argv[2] || '../vtgstnew');

if (!fs.existsSync(path.join(SRC, 'prisma', 'schema.prisma'))) {
  console.error(`Not the online app: ${SRC}`);
  process.exit(1);
}

const COPY = ['app', 'components', 'lib', 'public', 'tailwind.config.ts', 'postcss.config.mjs'];

/** Online-only paths (relative, forward slashes). */
const EXCLUDE = [
  'app/admin',
  'app/portal',
  'app/subscription',
  'app/api/admin',
  'app/api/portal',
  'app/api/subscription',
  'app/api/desktop',
  'app/api/media/test',
  'app/(auth)/register',
  'app/(auth)/forgot-password',
  'app/(auth)/reset-password',
  'app/api/auth/register',
  'app/api/auth/forgot-password',
  'app/api/auth/reset-password',
  'lib/desktop',
];

/** Desktop replacements of upstream files — never overwritten. */
export const DESKTOP_OWNED = [
  'app/page.tsx',
  'app/api/files/[...key]/route.ts',
  'lib/db.ts',
  'lib/auth.ts',
  'lib/s3.ts',
  'lib/r2.ts',
];

const rel = (p) => path.relative(SRC, p).split(path.sep).join('/');
const excluded = (r) => EXCLUDE.some((e) => r === e || r.startsWith(e + '/'));

let copied = 0;
let skipped = 0;
function copyRecursive(from) {
  const r = rel(from);
  if (excluded(r)) return;
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(from)) copyRecursive(path.join(from, name));
    return;
  }
  const to = path.join(ROOT, r);
  if (DESKTOP_OWNED.includes(r) && fs.existsSync(to)) {
    skipped++;
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  copied++;
}

for (const item of COPY) {
  const p = path.join(SRC, item);
  if (fs.existsSync(p)) copyRecursive(p);
}
fs.mkdirSync(path.join(ROOT, 'prisma'), { recursive: true });
fs.copyFileSync(path.join(SRC, 'prisma', 'schema.prisma'), path.join(ROOT, 'prisma', 'upstream.schema.prisma'));

let failed = 0;
for (const patch of PATCHES) {
  const file = path.join(ROOT, patch.file);
  if (!fs.existsSync(file)) {
    console.warn(`! patch target missing: ${patch.file}`);
    failed++;
    continue;
  }
  let text = fs.readFileSync(file, 'utf8');
  if (patch.marker && text.includes(patch.marker)) continue; // already applied
  if (!text.includes(patch.find)) {
    console.warn(`! patch "${patch.name}" no longer matches ${patch.file} — update scripts/desktop-patches.mjs`);
    failed++;
    continue;
  }
  text = text.replace(patch.find, patch.replace);
  fs.writeFileSync(file, text);
}

console.log(`Copied ${copied} files, kept ${skipped} desktop-owned files, ${PATCHES.length - failed}/${PATCHES.length} patches ok.`);
console.log('Next: npm run schema');
if (failed) process.exitCode = 2;

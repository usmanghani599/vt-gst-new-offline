/**
 * electron-builder afterPack hook.
 *
 * Copies build/server into <resources>/server ourselves. electron-builder's
 * extraResources copy filters node_modules (and dot-folders such as
 * node_modules/.prisma), which breaks the embedded server. The copy is then
 * verified against server-manifest.json so a broken package fails the build
 * here instead of on a customer's computer. Runs before signing/installer.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

exports.default = async function afterPack(context) {
  const src = path.join(__dirname, '..', 'build', 'server');
  if (!fs.existsSync(path.join(src, 'server-manifest.json'))) {
    throw new Error('build/server is missing — run `npm run build` before electron-builder');
  }
  const resources =
    context.electronPlatformName === 'darwin'
      ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : path.join(context.appOutDir, 'resources');
  const dest = path.join(resources, 'server');

  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, dereference: true });

  const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'server-manifest.json'), 'utf8'));
  const bad = [];
  for (const [rel, hash] of Object.entries(manifest.files)) {
    const file = path.join(dest, rel);
    if (!fs.existsSync(file)) bad.push(`missing ${rel}`);
    else if (crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== hash) bad.push(`changed ${rel}`);
  }
  if (bad.length) throw new Error(`Packaged server failed integrity check (${bad.length}):\n${bad.slice(0, 20).join('\n')}`);
  const buildId = (fs.readFileSync(path.join(__dirname, '..', 'electron', 'build-config.ts'), 'utf8').match(/"buildId": "([^"]+)"/) || [])[1] || '?';
  console.log(`  • afterPack: build ${buildId}: server copied and verified (${Object.keys(manifest.files).length} files) -> ${dest}`);
};

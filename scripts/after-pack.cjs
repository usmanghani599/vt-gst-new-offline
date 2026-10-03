/**
 * electron-builder afterPack hook: makes sure the packaged app contains the
 * server archive (resources/server.pack) byte-for-byte as built, so a broken
 * package fails here instead of on a customer's computer.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

exports.default = async function afterPack(context) {
  const root = path.join(__dirname, '..');
  const expected = fs.readFileSync(path.join(root, 'build', 'server-pack.sha256'), 'utf8').trim();
  const resources =
    context.electronPlatformName === 'darwin'
      ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : path.join(context.appOutDir, 'resources');
  const pack = path.join(resources, 'server.pack');
  if (!fs.existsSync(pack)) throw new Error(`server.pack missing from package: ${pack}`);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(pack)).digest('hex');
  if (actual !== expected) throw new Error('server.pack in the package differs from build/server.pack');
  const buildId = (fs.readFileSync(path.join(root, 'electron', 'build-config.ts'), 'utf8').match(/"buildId": "([^"]+)"/) || [])[1] || '?';
  console.log(`  • afterPack: build ${buildId}: server.pack present and verified (${(fs.statSync(pack).size / 1048576).toFixed(0)} MB)`);
};

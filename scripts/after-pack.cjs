/**
 * electron-builder afterPack hook: makes sure the packaged app contains the
 * server archive (resources/server.asar) byte-for-byte as built, so a broken
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
  const pack = path.join(resources, 'server.asar');
  if (!fs.existsSync(pack)) throw new Error(`server.asar missing from package: ${pack}`);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(pack)).digest('hex');
  if (actual !== expected) throw new Error('server.asar in the package differs from build/server.asar');
  const buildId = (fs.readFileSync(path.join(root, 'electron', 'build-config.ts'), 'utf8').match(/"buildId": "([^"]+)"/) || [])[1] || '?';
  console.log(`  • afterPack: build ${buildId}: server.asar present and verified (${(fs.statSync(pack).size / 1048576).toFixed(0)} MB)`);
};

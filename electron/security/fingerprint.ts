import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import { execFileSync } from 'child_process';

/**
 * Stable hardware/OS fingerprint of this computer.
 *
 * Based on the OS installation id (Windows MachineGuid, macOS IOPlatformUUID,
 * Linux machine-id), platform and architecture. CPU, hostname, user name,
 * memory and network adapters are deliberately excluded: they change in
 * normal use (upgrades, renames) and would lock owners out of their own data.
 * The raw value never leaves the machine; the server only sees
 * a salted hash.
 */

const APP_SALT = 'vtgst-desktop-fingerprint-v1';

function osMachineId(): string {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync(
        'reg',
        ['query', 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
        { encoding: 'utf8', windowsHide: true }
      );
      const m = out.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/);
      if (m) return m[1].toLowerCase();
    } else if (process.platform === 'darwin') {
      const out = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8' });
      const m = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (m) return m[1].toLowerCase();
    } else {
      for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
        if (fs.existsSync(f)) {
          const v = fs.readFileSync(f, 'utf8').trim();
          if (v) return v.toLowerCase();
        }
      }
    }
  } catch {
    /* fall through */
  }
  throw new Error('Could not read the machine id of this computer.');
}

let cached: string | null = null;

/** 64-char hex fingerprint. */
export function getFingerprint(): string {
  if (cached) return cached;
  const material = [APP_SALT, osMachineId(), process.platform, os.arch()].join('|');
  cached = crypto.createHash('sha256').update(material).digest('hex');
  return cached;
}

export function getDeviceName(): string {
  return `${os.hostname()} (${process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'})`;
}

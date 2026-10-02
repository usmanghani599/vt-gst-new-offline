import fs from 'fs';
import os from 'os';
import path from 'path';
import { app, dialog, BrowserWindow } from 'electron';
import { decryptBackup, deriveMasterKey, encryptBackup, keyCheck } from './backup-crypto';
import { connectGoogle, deleteBackup, disconnectGoogle, downloadBackup, googleConfigured, listBackups, uploadBackup } from './google-drive';
import { saveVault, updateVault, vault } from '../security/vault';
import { evaluate } from '../license/license-manager';
import { exportDatabaseImage, restoreDatabaseImage } from '../server/server-host';

const DEFAULT_AUTO = { enabled: true, hours: 24, keep: 30, localFolder: null as string | null };

function auto() {
  return { ...DEFAULT_AUTO, ...(vault().backupSettings || {}) };
}

function licensedEmail(): string | null {
  return evaluate().payload?.email || vault().license?.email || null;
}

export function backupInfo() {
  const v = vault();
  return {
    googleEmail: v.google?.email || null,
    licensedEmail: licensedEmail(),
    hasPassword: Boolean(v.backupKey),
    auto: auto(),
    lastBackupAt: v.lastBackupAt || null,
    lastBackupError: v.lastBackupError || null,
    googleConfigured: googleConfigured() && Boolean(evaluate().payload?.backup),
  };
}

export async function setBackupPassword(password: string, current?: string) {
  const v = vault();
  if (!v.backupSecret) throw new Error('Verify the license online first.');
  if (String(password).length < 8) throw new Error('Backup password must be at least 8 characters.');
  if (v.backupKey) {
    const currentKey = await deriveMasterKey(current || '', v.backupSecret);
    if (keyCheck(currentKey) !== v.backupKeyCheck) throw new Error('Current backup password is not correct.');
  }
  const master = await deriveMasterKey(password, v.backupSecret);
  updateVault({ backupKey: master.toString('hex'), backupKeyCheck: keyCheck(master) });
  return backupInfo();
}

export async function connect() {
  const email = licensedEmail();
  if (!email) throw new Error('Activate the license first.');
  if (!evaluate().payload?.backup) throw new Error('Google Drive backup is not included in your license.');
  await connectGoogle(email);
  return backupInfo();
}

export async function disconnect() {
  await disconnectGoogle();
  return backupInfo();
}

export function saveAuto(next: { enabled: boolean; hours: number; keep: number; localFolder: string | null }) {
  updateVault({
    backupSettings: {
      enabled: Boolean(next.enabled),
      hours: Math.min(168, Math.max(1, Number(next.hours) || 24)),
      keep: Math.min(365, Math.max(3, Number(next.keep) || 30)),
      localFolder: next.localFolder || null,
    },
  });
  return backupInfo();
}

export async function chooseLocalFolder(win: BrowserWindow | null) {
  const res = await dialog.showOpenDialog(win ?? undefined!, {
    title: 'Choose a folder for automatic encrypted backups',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: auto().localFolder || app.getPath('documents'),
  });
  if (!res.canceled && res.filePaths[0]) saveAuto({ ...auto(), localFolder: res.filePaths[0] });
  return backupInfo();
}

function backupName() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const host = os.hostname().replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'PC';
  return `VTGST-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${host}.vtgbak`;
}

async function createEncryptedBackup(): Promise<Buffer> {
  const v = vault();
  if (!v.backupKey) throw new Error('Set a backup password first.');
  const plain = await exportDatabaseImage();
  try {
    return encryptBackup(plain, Buffer.from(v.backupKey, 'hex'), { appVersion: app.getVersion(), device: os.hostname() });
  } finally {
    plain.fill(0);
  }
}

function pruneLocal(folder: string, keep: number) {
  const files = fs
    .readdirSync(folder)
    .filter((f) => /^VTGST-.*\.vtgbak$/.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(folder, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(keep)) fs.unlinkSync(path.join(folder, f));
}

async function pruneGoogle(keep: number) {
  const files = await listBackups();
  for (const f of files.slice(keep)) await deleteBackup(f.id);
}

export async function backupNow(target: 'google' | 'local' | 'file', win: BrowserWindow | null): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const name = backupName();
    if (target === 'file') {
      const res = await dialog.showSaveDialog(win ?? undefined!, {
        title: 'Save encrypted VTGST backup',
        defaultPath: path.join(app.getPath('documents'), name),
        filters: [{ name: 'VTGST backup', extensions: ['vtgbak'] }],
      });
      if (res.canceled || !res.filePath) return { ok: false };
      fs.writeFileSync(res.filePath, await createEncryptedBackup());
      return { ok: true, name: path.basename(res.filePath) };
    }
    const data = await createEncryptedBackup();
    if (target === 'google') {
      if (!vault().google) throw new Error('Connect your Google account first.');
      await uploadBackup(name, data);
      await pruneGoogle(auto().keep);
    } else {
      const folder = auto().localFolder;
      if (!folder) throw new Error('No backup folder chosen.');
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, name), data);
      pruneLocal(folder, auto().keep);
    }
    updateVault({ lastBackupAt: new Date().toISOString(), lastBackupError: null });
    return { ok: true, name };
  } catch (e: any) {
    updateVault({ lastBackupError: e.message });
    return { ok: false, error: e.message };
  }
}

async function restoreBuffer(file: Buffer, password: string) {
  const v = vault();
  if (!v.backupSecret) throw new Error('Activate this computer with the same license first.');
  const master = await deriveMasterKey(password, v.backupSecret);
  const plain = decryptBackup(file, master);
  await restoreDatabaseImage(plain);
  plain.fill(0);
  // Remember the password so automatic backups keep working after a restore.
  if (!v.backupKey) {
    v.backupKey = master.toString('hex');
    v.backupKeyCheck = keyCheck(master);
    saveVault();
  }
}

export async function restoreFromGoogle(fileId: string, password: string) {
  try {
    await restoreBuffer(await downloadBackup(fileId), password);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function restoreFromFile(password: string, win: BrowserWindow | null) {
  const res = await dialog.showOpenDialog(win ?? undefined!, {
    title: 'Choose a VTGST backup',
    properties: ['openFile'],
    filters: [{ name: 'VTGST backup', extensions: ['vtgbak'] }],
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false };
  try {
    await restoreBuffer(fs.readFileSync(res.filePaths[0]), password);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export { listBackups };

let timer: NodeJS.Timeout | null = null;
/** Runs automatic backups (Google and/or local folder) on the configured schedule. */
export function startBackupScheduler() {
  if (timer) return;
  const tick = async () => {
    const v = vault();
    const a = auto();
    if (!a.enabled || !v.backupKey) return;
    const last = v.lastBackupAt ? new Date(v.lastBackupAt).getTime() : 0;
    if (Date.now() - last < a.hours * 60 * 60 * 1000) return;
    if (v.google) await backupNow('google', null);
    if (a.localFolder) await backupNow('local', null);
  };
  setTimeout(tick, 2 * 60 * 1000);
  timer = setInterval(tick, 30 * 60 * 1000);
}

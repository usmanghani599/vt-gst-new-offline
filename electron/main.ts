import path from 'path';
import fs from 'fs';
import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session, shell, type IpcMainInvokeEvent } from 'electron';
import { loadVault, recordEvent } from './security/vault';
import { verifyServerIntegrity } from './security/integrity';
import {
  activate,
  checkClock,
  checkOnline,
  deactivate,
  evaluate,
  fetchReferenceData,
  isUsable,
  licenseInfo,
  onLicenseChange,
  startLicenseWatch,
} from './license/license-manager';
import {
  baseUrl,
  dataPaths,
  isDev,
  localApi,
  refreshLicenseInServer,
  serverDir,
  startServer,
  stopServer,
  tokens,
} from './server/server-host';
import * as backup from './backup/backup-manager';
import { getPrintSettings, listPrinters, printContents, savePrintSettings, testPrint, type PrintKind } from './print/print-manager';
import { BUILD_CONFIG } from './build-config';

const STATIC_DIR = path.join(__dirname, '..', 'electron-static');
const PRELOAD = path.join(__dirname, 'preload.js');

/**
 * Static screens (activation) are served from app.asar through a private
 * protocol: the GrantFileProtocolExtraPrivileges fuse is off, so file:// pages
 * cannot read from the asar archive.
 */
const APP_SCHEME = 'vtgst';
const APP_ORIGIN = `${APP_SCHEME}://app/`;
protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: false } }]);

const STATIC_TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.css': 'text/css' };

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const name = path.basename(decodeURIComponent(url.pathname));
    const file = path.join(STATIC_DIR, name);
    if (url.host !== 'app' || !STATIC_TYPES[path.extname(name)] || !fs.existsSync(file)) {
      return new Response('Not found', { status: 404 });
    }
    return new Response(fs.readFileSync(file), { headers: { 'Content-Type': STATIC_TYPES[path.extname(name)] } });
  });
}

let mainWindow: BrowserWindow | null = null;
let activationWindow: BrowserWindow | null = null;
let serverRunning = false;
let online = false;
let booting = true;

// ---------------------------------------------------------------------------
// Process hardening
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.on('second-instance', () => {
  const w = mainWindow || activationWindow;
  if (w) {
    if (w.isMinimized()) w.restore();
    w.focus();
  }
});

app.setAppUserModelId('com.vivertech.vtgst.desktop');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

// No remote debugging, no unexpected protocols.
for (const flag of ['remote-debugging-port', 'inspect', 'inspect-brk', 'js-flags']) {
  if (app.isPackaged && app.commandLine.hasSwitch(flag)) app.exit(1);
}

app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    const allowed = (serverRunning && url.startsWith(baseUrl())) || url.startsWith(APP_ORIGIN);
    if (!allowed) {
      event.preventDefault();
      if (/^https:\/\//.test(url)) shell.openExternal(url);
    }
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
  if (app.isPackaged) {
    contents.on('devtools-opened', () => contents.closeDevTools());
  }
});

function trustedSender(e: IpcMainInvokeEvent): boolean {
  const url = e.senderFrame?.url || '';
  return (serverRunning && url.startsWith(baseUrl() + '/')) || url.startsWith(APP_ORIGIN);
}

function handle(channel: string, fn: (e: IpcMainInvokeEvent, ...args: any[]) => unknown) {
  ipcMain.handle(channel, async (e, ...args) => {
    if (!trustedSender(e)) throw new Error('Blocked');
    return fn(e, ...args);
  });
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

function webPrefs(): Electron.WebPreferences {
  return {
    preload: PRELOAD,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
    spellcheck: false,
    devTools: !app.isPackaged,
  };
}

function iconPath() {
  const p = path.join(STATIC_DIR, 'icon.png');
  return fs.existsSync(p) ? p : undefined;
}

function openActivationWindow(): Promise<void> {
  return new Promise((resolve) => {
    if (activationWindow) {
      activationWindow.focus();
      return;
    }
    activationWindow = new BrowserWindow({
      width: 560,
      height: 680,
      resizable: false,
      title: 'Activate VTGST Desktop',
      backgroundColor: '#f8fafc',
      icon: iconPath(),
      webPreferences: webPrefs(),
    });
    activationWindow.setMenuBarVisibility(false);
    activationWindow.loadURL(`${APP_ORIGIN}activation.html`);
    activationWindow.on('closed', () => {
      activationWindow = null;
      resolve();
    });
  });
}

async function createMainWindow(initialPath: string) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'VTGST Desktop',
    backgroundColor: '#f8fafc',
    icon: iconPath(),
    webPreferences: webPrefs(),
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  // Permissions: camera for the barcode scanner only; nothing else.
  mainWindow.webContents.session.setPermissionRequestHandler((wc, permission, cb) => {
    cb(permission === 'media' && wc.getURL().startsWith(baseUrl()));
  });
  await mainWindow.loadURL(baseUrl() + initialPath);
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'VTGST',
      submenu: [
        { label: 'Dashboard', click: () => mainWindow?.loadURL(baseUrl() + '/dashboard') },
        { label: 'License, Sync, Backup & Print…', click: () => mainWindow?.loadURL(baseUrl() + '/desktop/settings') },
        { type: 'separator' },
        { label: 'Back up to file now…', click: () => backup.backupNow('file', mainWindow) },
        { type: 'separator' },
        {
          label: 'About VTGST Desktop',
          click: () =>
            dialog.showMessageBox({ title: 'About', message: `VTGST Desktop ${app.getVersion()}`, detail: `Build ${BUILD_CONFIG.buildId}` }),
        },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' } as Electron.MenuItemConstructorOptions]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function fatal(title: string, message: string): Promise<never> {
  await dialog.showMessageBox({ type: 'error', title, message, buttons: ['Close'] });
  app.exit(1);
  throw new Error(message);
}

async function handleForeignVault() {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title: 'VTGST Desktop',
    message: 'The VTGST data on this computer cannot be opened.',
    detail:
      'The installation was copied from another computer or the operating system was reinstalled. ' +
      'For security, encrypted data can only be opened on the computer that created it.\n\n' +
      'You can start a fresh installation here and restore your encrypted backup after activating your license.',
    buttons: ['Quit', 'Start fresh (keep old files aside)'],
    defaultId: 0,
    cancelId: 0,
  });
  if (response !== 1) {
    app.exit(0);
    return;
  }
  const userData = app.getPath('userData');
  const stamp = Date.now();
  for (const name of ['data', 'vault.dat', 'vault.bak']) {
    const p = path.join(userData, name);
    if (fs.existsSync(p)) fs.renameSync(p, path.join(userData, `${name}.orphan-${stamp}`));
  }
  app.relaunch();
  app.exit(0);
}

async function ensureReferenceData(force: boolean) {
  const state = await localApi<{ users: number; hasReferenceData: boolean }>('/api/local/main/state');
  if (state.hasReferenceData && !force) return state;
  try {
    const ref = await fetchReferenceData();
    await localApi('/api/local/main/reference', ref);
  } catch (e: any) {
    if (!state.hasReferenceData) throw new Error(`Could not download master data (GST rates, states): ${e.message}`);
  }
  return localApi<{ users: number; hasReferenceData: boolean }>('/api/local/main/state');
}

async function boot() {
  const vaultState = loadVault();
  if (vaultState === 'foreign') return handleForeignVault();

  if (!BUILD_CONFIG.licensePublicKey) {
    return fatal('VTGST Desktop', 'This build has no license public key. Build with VTGST_LICENSE_PUBLIC_KEY set.');
  }
  if (app.isPackaged) {
    const integrity = verifyServerIntegrity(serverDir());
    if (!integrity.ok) {
      recordEvent('INTEGRITY_FAILED', { reason: integrity.reason });
      return fatal(
        'VTGST Desktop',
        `This installation is damaged or was modified (${integrity.reason}). Please reinstall VTGST Desktop.\n\n` +
          `Build ${BUILD_CONFIG.buildId}\nFolder: ${serverDir()}`
      );
    }
  }
  checkClock();

  // Activation (first run or license moved)
  let justActivated = false;
  const initial = evaluate().state;
  if (initial === 'NOT_ACTIVATED' || initial === 'DEVICE_MISMATCH') {
    await openActivationWindow();
    const after = evaluate().state;
    if (after === 'NOT_ACTIVATED' || after === 'DEVICE_MISMATCH') return app.quit();
    justActivated = true;
  }

  buildMenu();
  try {
    await startServer();
    serverRunning = true;
  } catch (e: any) {
    return fatal('VTGST Desktop', `Could not open the local database: ${e.message}`);
  }

  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['http://127.0.0.1/*'] }, (details, cb) => {
    const headers = details.requestHeaders;
    if (details.url.startsWith(baseUrl() + '/')) headers['x-vtgst-internal'] = tokens.internal;
    cb({ requestHeaders: headers });
  });

  let state: { users: number; hasReferenceData: boolean };
  try {
    state = await ensureReferenceData(justActivated);
  } catch (e: any) {
    return fatal('VTGST Desktop', e.message);
  }

  const usable = isUsable(evaluate().state);
  await createMainWindow(!usable ? '/desktop/locked' : state.users === 0 ? '/desktop/setup' : '/login');

  onLicenseChange(() => {
    refreshLicenseInServer();
    const ok = isUsable(evaluate().state);
    const url = mainWindow?.webContents.getURL() || '';
    if (!ok && mainWindow && !url.includes('/desktop/locked')) mainWindow.loadURL(baseUrl() + '/desktop/locked');
  });
  startLicenseWatch();
  backup.startBackupScheduler();
  startSyncScheduler();
  booting = false;
}

// ---------------------------------------------------------------------------
// Background sync (only when linked to online; data otherwise stays local)
// ---------------------------------------------------------------------------

let lastSyncAttempt = 0;
function startSyncScheduler() {
  const tick = async () => {
    const wasOnline = online;
    online = net.isOnline();
    if (!online || !serverRunning || !isUsable(evaluate().state)) return;
    const due = Date.now() - lastSyncAttempt > 2 * 60 * 1000 || (!wasOnline && online);
    if (!due) return;
    lastSyncAttempt = Date.now();
    try {
      const { status } = await localApi<{ status: { linked: boolean } }>('/api/local/main/sync', { action: 'status' });
      if (status.linked) await localApi('/api/local/main/sync', { action: 'run' });
    } catch {
      /* reported in status */
    }
  };
  setInterval(tick, 15 * 1000);
  setTimeout(tick, 5000);
}

async function syncCall(body: Record<string, unknown>) {
  const res = await localApi<{ status: any }>('/api/local/main/sync', body);
  return { ...res.status, online: net.isOnline() };
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

function registerIpc() {
  handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, dataDir: dataPaths().dataDir, online: net.isOnline() }));
  handle('app:quit', () => app.quit());

  handle('activation:activate', async (_e, licenseKey: string, email: string) => {
    try {
      await activate(String(licenseKey || ''), String(email || ''));
      if (serverRunning) {
        refreshLicenseInServer();
        await ensureReferenceData(true).catch(() => {});
        mainWindow?.loadURL(baseUrl() + '/');
      }
      setTimeout(() => activationWindow?.close(), 900);
      return { ok: true, info: licenseInfo() };
    } catch (e: any) {
      return { ok: false, error: e.message, code: e.code };
    }
  });

  handle('license:info', () => licenseInfo());
  handle('license:check', async () => {
    try {
      await checkOnline();
    } catch (e: any) {
      return { ...licenseInfo(), message: e.message };
    }
    return licenseInfo();
  });
  handle('license:deactivate', async () => {
    try {
      await deactivate();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });
  handle('license:open-activation', () => {
    openActivationWindow();
  });

  handle('print:current', async (e, opts: { kind: PrintKind }) => printContents(e.sender, opts?.kind === 'receipt' ? 'receipt' : 'document'));
  handle('print:printers', (e) => listPrinters(e.sender));
  handle('print:get', () => getPrintSettings());
  handle('print:save', (_e, s) => savePrintSettings(s));
  handle('print:test', (_e, kind: PrintKind) => testPrint(kind === 'receipt' ? 'receipt' : 'document'));

  handle('sync:status', () => syncCall({ action: 'status' }));
  handle('sync:run', (_e, deep: boolean) => syncCall({ action: deep ? 'deep' : 'run' }));
  handle('sync:companies', async (_e, email: string, password: string) => {
    const res = await localApi('/api/local/main/sync', { action: 'companies', email, password });
    return { accountName: res.accountName, companies: res.companies };
  });
  handle('sync:link', (_e, opts: any) =>
    syncCall({ action: 'link', email: opts?.email, password: opts?.password, mode: opts?.mode, companyId: opts?.companyId })
  );
  handle('sync:unlink', () => syncCall({ action: 'unlink' }));

  handle('backup:info', () => backup.backupInfo());
  handle('backup:set-password', (_e, pw: string, current?: string) => backup.setBackupPassword(pw, current));
  handle('backup:google-connect', () => backup.connect());
  handle('backup:google-disconnect', () => backup.disconnect());
  handle('backup:save-auto', (_e, a) => backup.saveAuto(a));
  handle('backup:choose-folder', () => backup.chooseLocalFolder(mainWindow));
  handle('backup:now', (_e, target: 'google' | 'local' | 'file') => backup.backupNow(target, mainWindow));
  handle('backup:list-google', () => backup.listBackups());
  const afterRestore = (r: { ok: boolean }) => {
    if (r.ok) mainWindow?.loadURL(baseUrl() + '/login');
    return r;
  };
  handle('backup:restore-google', async (_e, id: string, pw: string) => afterRestore(await backup.restoreFromGoogle(id, pw)));
  handle('backup:restore-file', async (_e, pw: string) => afterRestore(await backup.restoreFromFile(pw, mainWindow)));
}

app.whenReady().then(async () => {
  registerAppProtocol();
  registerIpc();
  try {
    await boot();
  } catch (e: any) {
    console.error(e);
    app.exit(1);
  }
});

app.on('window-all-closed', () => {
  // During startup the activation window closes before the main window opens.
  if (!booting && !activationWindow) app.quit();
});

let quitting = false;
app.on('before-quit', (e) => {
  if (quitting || !serverRunning) return;
  e.preventDefault();
  quitting = true;
  stopServer().finally(() => app.quit());
});

process.on('unhandledRejection', (err) => console.error('[main] unhandled', err));
if (isDev) console.log('[main] VTGST desktop (development mode)');

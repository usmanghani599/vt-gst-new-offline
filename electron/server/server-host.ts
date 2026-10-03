import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { app, utilityProcess, type UtilityProcess } from 'electron';
import { BUILD_CONFIG } from '../build-config';
import { getFingerprint } from '../security/fingerprint';
import { databaseKey, vault } from '../security/vault';
import { evaluate, type LicensePayload, type LicenseState } from '../license/license-manager';

/**
 * Runs the Next.js app (same UI as online) in an Electron utility process,
 * bound to 127.0.0.1 on a random port, protected by per-launch secrets.
 */

export const isDev = process.env.VTGST_DEV === '1' && !app.isPackaged;

export const tokens = {
  internal: crypto.randomBytes(32).toString('hex'),
  main: crypto.randomBytes(32).toString('hex'),
};

let child: UtilityProcess | null = null;
let port = 0;
let exportSeq = 0;
const pendingExports = new Map<number, { resolve: (b: Buffer) => void; reject: (e: Error) => void }>();

/** Unpackaged test runs may point at a prepared bundle (npm run bundle) instead of `next dev`. */
const bundleOverride = !app.isPackaged ? process.env.VTGST_SERVER_DIR : undefined;

let packagedServerDir: string | null = null;
/** Set by main after the server archive has been unpacked (packaged builds). */
export function setPackagedServerDir(dir: string) {
  packagedServerDir = dir;
}

export function serverDir(): string {
  if (bundleOverride) return path.resolve(bundleOverride);
  if (isDev) return app.getAppPath();
  if (!packagedServerDir) throw new Error('Server not unpacked yet');
  return packagedServerDir;
}

function entryPath(): string {
  return isDev && !bundleOverride ? path.join(app.getAppPath(), 'desktop-server', 'server-entry.js') : path.join(serverDir(), 'server-entry.js');
}

export function dataPaths() {
  const dataDir = path.join(app.getPath('userData'), 'data');
  return { dataDir, dbPath: path.join(dataDir, 'vtgst.db'), filesDir: path.join(dataDir, 'files') };
}

export function baseUrl(): string {
  return `http://127.0.0.1:${port}`;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const p = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(p));
    });
  });
}

export function licenseRuntime(): { token: string | null; state: LicenseState; payload: LicensePayload | null; licenseKey: string | null } {
  const v = vault();
  const { state, payload } = evaluate();
  return { token: v.license?.token || null, state, payload, licenseKey: v.license?.licenseKey || null };
}

function buildRuntime() {
  const v = vault();
  const paths = dataPaths();
  return {
    appVersion: app.getVersion(),
    ...paths,
    dbKey: databaseKey(),
    internalToken: tokens.internal,
    mainToken: tokens.main,
    sessionSecret: v.sessionSecret,
    licensePublicKey: BUILD_CONFIG.licensePublicKey,
    fingerprint: getFingerprint(),
    license: licenseRuntime(),
    device: {
      activationId: v.license?.activationId || null,
      privateKeyPem: v.device?.privateKeyPem || null,
      publicKeyPem: v.device?.publicKeyPem || null,
    },
    sync: { serverUrl: BUILD_CONFIG.serverUrl, linkedCompanyId: null, seriesCode: null },
  };
}

function fork(args: string[]): UtilityProcess {
  return utilityProcess.fork(entryPath(), args, {
    serviceName: 'VTGST Server',
    stdio: 'pipe',
    cwd: serverDir(),
    env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production', NEXT_TELEMETRY_DISABLED: '1' },
  });
}

async function waitUntilReady(timeoutMs: number) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl()}/api/local/main/state`, {
        headers: { 'x-vtgst-internal': tokens.internal, 'x-vtgst-main': tokens.main },
      });
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('The local VTGST server did not start in time.');
}

export async function startServer(): Promise<void> {
  if (child) return;
  fs.mkdirSync(dataPaths().dataDir, { recursive: true });
  port = await freePort();
  const proc = fork([]);
  child = proc;

  proc.stdout?.on('data', (d) => process.stdout.write(`[server] ${d}`));
  proc.stderr?.on('data', (d) => process.stderr.write(`[server] ${d}`));

  const fatal = new Promise<never>((_, reject) => {
    proc.on('message', (msg: any) => {
      if (msg?.type === 'fatal') reject(new Error(msg.message));
      else if (msg?.type === 'log') console.log(`[server] ${msg.message}`);
      else if (msg?.type === 'export-result') {
        const p = pendingExports.get(msg.id);
        if (p) {
          pendingExports.delete(msg.id);
          msg.error ? p.reject(new Error(msg.error)) : p.resolve(Buffer.from(msg.data));
        }
      }
    });
    proc.on('exit', (code) => {
      if (child === proc) child = null;
      reject(new Error(`Local server stopped (code ${code}).`));
    });
  });
  fatal.catch(() => {});

  proc.postMessage({ type: 'init', runtime: buildRuntime(), port, dev: isDev && !bundleOverride, appDir: serverDir() });
  await Promise.race([waitUntilReady(isDev ? 180_000 : 60_000), fatal]);
}

export async function stopServer(): Promise<void> {
  const proc = child;
  if (!proc) return;
  child = null;
  await new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      proc.kill();
      resolve();
    }, 5000);
    proc.once('exit', () => {
      clearTimeout(t);
      resolve();
    });
    proc.postMessage({ type: 'shutdown' });
  });
}

/** Pushes live changes (license / device) into the server's in-memory runtime. */
export function pushRuntime(patch: Record<string, unknown>) {
  child?.postMessage({ type: 'runtime', patch });
}

export function refreshLicenseInServer() {
  const v = vault();
  pushRuntime({
    license: licenseRuntime(),
    device: { activationId: v.license?.activationId || null, privateKeyPem: v.device?.privateKeyPem || null, publicKeyPem: v.device?.publicKeyPem || null },
  });
}

/** Calls a main-only local API. */
export async function localApi<T = any>(pathname: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const res = await fetch(`${baseUrl()}${pathname}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-vtgst-internal': tokens.internal, 'x-vtgst-main': tokens.main },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Local server error ${res.status}`);
  return json as T;
}

/** Plain SQLite image of the live database (in memory only). */
export function exportDatabaseImage(): Promise<Buffer> {
  if (!child) return Promise.reject(new Error('Local server is not running'));
  const id = ++exportSeq;
  return new Promise((resolve, reject) => {
    pendingExports.set(id, { resolve, reject });
    child!.postMessage({ type: 'export', id });
    setTimeout(() => {
      if (pendingExports.delete(id)) reject(new Error('Backup export timed out'));
    }, 120_000);
  });
}

/** Stops the server, replaces the database with `plain`, restarts. */
export async function restoreDatabaseImage(plain: Buffer): Promise<void> {
  await stopServer();
  const proc = fork(['--restore']);
  try {
    await new Promise<void>((resolve, reject) => {
      proc.on('message', (msg: any) => {
        if (msg?.type === 'restored') resolve();
        else if (msg?.type === 'fatal') reject(new Error(msg.message));
      });
      proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Restore process exited (${code})`))));
      proc.postMessage({ type: 'init', runtime: buildRuntime(), port: 0, dev: isDev && !bundleOverride, appDir: serverDir(), plain });
    });
  } finally {
    await startServer();
  }
}

/**
 * End-to-end test of the desktop server against a running ONLINE server.
 * Emulates what the Electron main process does (activation, signed calls,
 * runtime injection) and drives the real built desktop server (build/server).
 *
 *   ONLINE_URL=http://127.0.0.1:3900 LICENSE_PUBLIC_KEY_FILE=public.pem \
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... OWNER_EMAIL=... OWNER_PASSWORD=... \
 *   npx tsx tests/e2e/desktop-e2e.ts
 *
 * Requires `npm run build:web && npm run bundle`
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fork, type ChildProcess } from 'child_process';
import { decryptBackup, deriveMasterKey, encryptBackup, keyCheck } from '../../electron/backup/backup-crypto';

const ONLINE = process.env.ONLINE_URL || 'http://127.0.0.1:3900';
const PUBLIC_KEY = fs.readFileSync(process.env.LICENSE_PUBLIC_KEY_FILE || 'public.pem', 'utf8');
const ADMIN = { email: process.env.ADMIN_EMAIL || 'superadmin@vtgst.com', password: process.env.ADMIN_PASSWORD || 'Admin@123456' };
const OWNER = { email: process.env.OWNER_EMAIL || 'owner@vivertech.com', password: process.env.OWNER_PASSWORD || 'Owner@123456' };
const ROOT = path.resolve(__dirname, '..', '..');
const ENTRY = path.join(ROOT, 'build', 'server', 'server-entry.js');

let passed = 0;
function ok(cond: unknown, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  passed++;
  console.log(`  ✔ ${label}`);
}

// ------------------------------------------------------------------ online helpers

async function onlineLogin(email: string, password: string) {
  const res = await fetch(`${ONLINE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  if (!res.ok || !cookie) throw new Error(`online login failed for ${email}`);
  return cookie;
}

async function onlineJson(cookie: string, pathname: string, init: RequestInit & { company?: string } = {}) {
  const res = await fetch(`${ONLINE}${pathname}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie, ...(init.company ? { 'x-company-id': init.company } : {}), ...(init.headers || {}) },
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
}

// ------------------------------------------------------------------ device emulation

const device = crypto.generateKeyPairSync('ed25519');
const devicePriv = device.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const devicePub = device.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const fingerprint = crypto.randomBytes(32).toString('hex');
let activationId = '';

async function signedPost(pathname: string, body: unknown) {
  const raw = JSON.stringify(body ?? {});
  const ts = String(Date.now());
  const nonce = crypto.randomBytes(16).toString('hex');
  const msg = ['POST', pathname, ts, nonce, crypto.createHash('sha256').update(raw).digest('hex')].join('\n');
  const sig = crypto.sign(null, Buffer.from(msg), crypto.createPrivateKey(devicePriv)).toString('base64url');
  const res = await fetch(`${ONLINE}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-vt-activation': activationId, 'x-vt-timestamp': ts, 'x-vt-nonce': nonce, 'x-vt-signature': sig },
    body: raw,
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
}

// ------------------------------------------------------------------ desktop server

interface Desktop {
  proc: ChildProcess;
  port: number;
  runtime: any;
  cookie: string;
  call: (pathname: string, init?: RequestInit & { main?: boolean; raw?: boolean }) => Promise<{ status: number; body: any; headers: Headers }>;
  request: (type: string, extra?: any) => Promise<any>;
}

function decodeToken(token: string) {
  const [, body] = token.split('.');
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
}

function makeRuntime(dataDir: string, token: string, licenseKey: string, dbKey: string) {
  return {
    appVersion: '1.0.0-test',
    dataDir,
    dbPath: path.join(dataDir, 'vtgst.db'),
    filesDir: path.join(dataDir, 'files'),
    dbKey,
    internalToken: crypto.randomBytes(16).toString('hex'),
    mainToken: crypto.randomBytes(16).toString('hex'),
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    licensePublicKey: PUBLIC_KEY,
    fingerprint,
    license: { token, state: 'VALID', payload: decodeToken(token), licenseKey },
    device: { activationId, privateKeyPem: devicePriv, publicKeyPem: devicePub },
    sync: { serverUrl: ONLINE, linkedCompanyId: null, seriesCode: null },
  };
}

const children: ChildProcess[] = [];
process.on('exit', () => children.forEach((c) => c.kill()));

function forkEntry(args: string[] = []) {
  const child = fork(path.join(__dirname, 'fork-wrapper.cjs'), args, {
    env: { ...process.env, VTGST_ENTRY: ENTRY },
    cwd: path.dirname(ENTRY),
    serialization: 'advanced',
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  children.push(child);
  return child;
}

async function startDesktop(runtime: any, port: number): Promise<Desktop> {
  const proc = forkEntry();
  const waiters = new Map<string, (m: any) => void>();
  proc.on('message', (m: any) => {
    if (m?.type === 'log' && process.env.VERBOSE) console.log('    [desktop]', m.message);
    if (m?.type === 'fatal') console.error('    [desktop fatal]', m.message);
    const w = waiters.get(m?.type);
    if (w) {
      waiters.delete(m.type);
      w(m);
    }
  });
  proc.send({ type: 'init', runtime, port, dev: false, appDir: path.dirname(ENTRY) });

  const d: Desktop = {
    proc,
    port,
    runtime,
    cookie: '',
    async call(pathname, init = {}) {
      const res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
        ...init,
        redirect: 'manual',
        headers: {
          'content-type': 'application/json',
          ...(init.raw ? {} : { 'x-vtgst-internal': runtime.internalToken }),
          ...(init.main ? { 'x-vtgst-main': runtime.mainToken } : {}),
          ...(d.cookie ? { cookie: d.cookie } : {}),
          ...(init.headers || {}),
        },
      });
      const text = await res.text();
      let body: any = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* html */
      }
      return { status: res.status, body, headers: res.headers };
    },
    request(type, extra = {}) {
      return new Promise((resolve) => {
        waiters.set(`${type}-result`, resolve);
        proc.send({ type, id: 1, ...extra });
      });
    },
  };
  for (let i = 0; i < 120; i++) {
    try {
      const r = await d.call('/api/local/main/state', { main: true });
      if (r.status === 200) return d;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('desktop server did not start');
}

async function stopDesktop(d: Desktop) {
  d.proc.send({ type: 'shutdown' });
  await new Promise((r) => d.proc.once('exit', r));
}

async function freePort() {
  const net = await import('net');
  return new Promise<number>((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as any).port;
      s.close(() => resolve(p));
    });
  });
}

// ------------------------------------------------------------------ test

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vtgst-e2e-'));
  const dataDir = path.join(tmp, 'data');
  const dbKey = crypto.randomBytes(32).toString('hex');

  console.log('1. License issue & activation');
  const admin = await onlineLogin(ADMIN.email, ADMIN.password);
  const created = await onlineJson(admin, '/api/admin/desktop-licenses', {
    method: 'POST',
    body: JSON.stringify({ customerName: 'E2E Traders', ownerEmail: OWNER.email, maxDevices: 1, offlineGraceDays: 10 }),
  });
  ok(created.status === 200 && /^VTG-/.test(created.body.license.licenseKey), 'admin issues license');
  const licenseKey = created.body.license.licenseKey as string;
  const licenseId = created.body.license.id as string;

  const ts = Date.now();
  const proof = crypto.sign(null, Buffer.from(`ACTIVATE\n${licenseKey}\n${fingerprint}\n${ts}`), crypto.createPrivateKey(devicePriv)).toString('base64url');
  const actBody = { licenseKey, email: OWNER.email, fingerprint, deviceName: 'E2E PC', platform: 'test', appVersion: '1.0.0', devicePublicKey: devicePub, timestamp: ts, proof };
  const wrongEmail = await fetch(`${ONLINE}/api/desktop/license/activate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...actBody, email: 'someone@else.com' }),
  });
  ok(wrongEmail.status === 403, 'activation with wrong email is rejected');
  const act = await (await fetch(`${ONLINE}/api/desktop/license/activate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(actBody) })).json();
  ok(act.success && act.token && act.backupSecret?.length === 64, 'activation returns signed token + backup secret');
  activationId = act.activationId;
  const payload = decodeToken(act.token);
  const [, b, s] = act.token.split('.');
  ok(crypto.verify(null, Buffer.from(`VTL1.${b}`), crypto.createPublicKey(PUBLIC_KEY), Buffer.from(s, 'base64url')), 'token signature verifies with public key');
  ok(payload.fp === crypto.createHash('sha256').update(`vtgst-fp:${fingerprint}`).digest('hex'), 'token bound to fingerprint');

  // Second device must be refused (maxDevices = 1)
  const dev2 = crypto.generateKeyPairSync('ed25519');
  const fp2 = crypto.randomBytes(32).toString('hex');
  const ts2 = Date.now();
  const proof2 = crypto.sign(null, Buffer.from(`ACTIVATE\n${licenseKey}\n${fp2}\n${ts2}`), dev2.privateKey).toString('base64url');
  const seat = await fetch(`${ONLINE}/api/desktop/license/activate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...actBody, fingerprint: fp2, devicePublicKey: dev2.publicKey.export({ type: 'spki', format: 'pem' }), timestamp: ts2, proof: proof2 }),
  });
  ok(seat.status === 403 && (await seat.json()).code === 'SEAT_LIMIT', 'second computer blocked by seat limit');

  const check = await signedPost('/api/desktop/license/check', { fingerprint, appVersion: '1.0.0', events: [{ event: 'TEST', at: Date.now() }] });
  ok(check.body.status === 'OK' && check.body.token, 'signed online check-in renews token');
  const badCheck = await signedPost('/api/desktop/license/check', { fingerprint: fp2 });
  ok(badCheck.body.status === 'DEVICE_MISMATCH', 'check-in from another fingerprint is refused');

  console.log('2. Desktop server, encrypted DB, reference data, setup');
  const runtime = makeRuntime(dataDir, check.body.token, licenseKey, dbKey);
  const desk = await startDesktop(runtime, await freePort());
  const header = fs.readFileSync(runtime.dbPath).subarray(0, 16).toString('latin1');
  ok(!header.startsWith('SQLite format'), 'database file is encrypted on disk');

  const forbidden = await desk.call('/login', { raw: true });
  ok(forbidden.status === 403, 'requests without the per-launch token are rejected');
  const noMain = await desk.call('/api/local/main/state');
  ok(noMain.status === 403, 'main-only API refuses renderer token');

  const ref = await signedPost('/api/desktop/reference-data', {});
  ok(ref.status === 200 && ref.body.data?.State?.length > 10, `signed reference data download (${ref.status} ${JSON.stringify(ref.body).slice(0, 200)})`);
  const imp = await desk.call('/api/local/main/reference', { method: 'POST', main: true, body: JSON.stringify({ order: ref.body.order, data: ref.body.data }) });
  ok(imp.status === 200 && imp.body.counts.TaxRate > 0, 'reference data imported with server ids');

  const setup = await desk.call('/api/local/setup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Desk Owner', email: 'desk@local.test', password: 'Desk@12345', companyName: 'Offline Mart', stateCode: '27', mode: 'new' }),
  });
  ok(setup.status === 200 && setup.body.companyId, 'first-run setup creates company');
  const companyId = setup.body.companyId as string;
  desk.cookie = (setup.headers.get('set-cookie') || '').split(';')[0];

  const party = await desk.call('/api/parties', { method: 'POST', body: JSON.stringify({ name: 'Offline Customer', partyType: 'CUSTOMER', mobile: '9000000001' }) });
  ok(party.status === 200 || party.status === 201, 'create party offline');
  const partyId = party.body.party?.id || party.body.id;
  const doc1 = await desk.call('/api/documents', {
    method: 'POST',
    body: JSON.stringify({
      documentType: 'SALE',
      documentDate: new Date().toISOString(),
      partyId,
      items: [{ itemName: 'Widget', quantity: 2, unitRate: 150, taxPercentage: 18 }],
    }),
  });
  ok(doc1.status === 200 && doc1.body.document?.documentNumber, `create invoice offline (${doc1.body.document?.documentNumber || doc1.body.error})`);
  const s0 = await desk.call('/api/local/main/sync', { method: 'POST', main: true, body: JSON.stringify({ action: 'status' }) });
  ok(s0.body.status.linked === false && s0.body.status.pending === 0, 'offline-only: nothing is queued for upload');

  console.log('3. Join online (upload) + two-way sync');
  const link = await desk.call('/api/local/main/sync', {
    method: 'POST',
    main: true,
    body: JSON.stringify({ action: 'link', mode: 'upload', companyId, email: OWNER.email, password: OWNER.password }),
  });
  ok(link.status === 200 && link.body.status.linked, `link + initial upload (${link.body.error || link.body.status?.lastError || 'ok'})`);
  ok(link.body.status.pending === 0 && !link.body.status.lastError, `all rows uploaded (pending ${link.body.status.pending}, failed ${JSON.stringify(link.body.status.failed).slice(0, 300)})`);
  if (link.body.status.failed?.length) console.log('   failed:', link.body.status.failed);

  const owner = await onlineLogin(OWNER.email, OWNER.password);
  const onlineParties = await onlineJson(owner, '/api/parties', { company: companyId });
  const plist = onlineParties.body.parties || onlineParties.body;
  ok(Array.isArray(plist) && plist.some((p: any) => p.name === 'Offline Customer'), 'desktop party visible online');
  const onlineDocs = await onlineJson(owner, '/api/documents?type=SALE', { company: companyId });
  const dlist = onlineDocs.body.documents || onlineDocs.body;
  ok(Array.isArray(dlist) && dlist.some((d: any) => d.documentNumber === doc1.body.document.documentNumber), 'desktop invoice visible online');

  const doc2 = await desk.call('/api/documents', {
    method: 'POST',
    body: JSON.stringify({ documentType: 'SALE', documentDate: new Date().toISOString(), partyId, items: [{ itemName: 'Gadget', quantity: 1, unitRate: 99, taxPercentage: 5 }] }),
  });
  ok(String(doc2.body.document?.documentNumber || '').startsWith(`${payload.series}-INV/`), `linked device uses its own series (${doc2.body.document?.documentNumber})`);

  const onParty = await onlineJson(owner, '/api/parties', { method: 'POST', company: companyId, body: JSON.stringify({ name: 'Online Supplier', partyType: 'SUPPLIER' }) });
  ok(onParty.status === 200 || onParty.status === 201, 'create party online (web)');
  await new Promise((r) => setTimeout(r, 3500)); // outbox settle window
  const run = await desk.call('/api/local/main/sync', { method: 'POST', main: true, body: JSON.stringify({ action: 'run' }) });
  ok(!run.body.status.lastError, `sync run (${run.body.status.lastError || 'ok'})`);
  const localParties = await desk.call('/api/parties');
  const lp = localParties.body.parties || localParties.body;
  ok(lp.some((p: any) => p.name === 'Online Supplier'), 'online party pulled to desktop');
  const onlineDocs2 = await onlineJson(owner, '/api/documents?type=SALE', { company: companyId });
  ok((onlineDocs2.body.documents || onlineDocs2.body).some((d: any) => d.documentNumber === doc2.body.document.documentNumber), 'new desktop invoice pushed online');

  // Internet drops while linked: work continues locally and is uploaded later.
  desk.proc.send({ type: 'runtime', patch: { sync: { serverUrl: 'http://127.0.0.1:9' } } });
  const offDoc = await desk.call('/api/documents', {
    method: 'POST',
    body: JSON.stringify({ documentType: 'SALE', documentDate: new Date().toISOString(), partyId, items: [{ itemName: 'Offline sale', quantity: 3, unitRate: 10, taxPercentage: 0 }] }),
  });
  ok(offDoc.status === 200, 'invoice saved locally while offline');
  await new Promise((r) => setTimeout(r, 3500));
  const offRun = await desk.call('/api/local/main/sync', { method: 'POST', main: true, body: JSON.stringify({ action: 'run' }) });
  ok(/internet/i.test(offRun.body.status.lastError || '') && offRun.body.status.pending > 0, `offline: changes kept in queue (${offRun.body.status.pending} pending)`);
  desk.proc.send({ type: 'runtime', patch: { sync: { serverUrl: ONLINE } } });
  const backRun = await desk.call('/api/local/main/sync', { method: 'POST', main: true, body: JSON.stringify({ action: 'run' }) });
  ok(backRun.body.status.pending === 0 && !backRun.body.status.lastError, 'back online: queue uploaded');
  const onlineDocs3 = await onlineJson(owner, '/api/documents?type=SALE', { company: companyId });
  ok((onlineDocs3.body.documents || onlineDocs3.body).some((d: any) => d.id === offDoc.body.document.id), 'offline invoice now online');

  // Delete (online) an invoice that was created on the desktop; ledger/stock rows are reversed online too.
  const doc2Id = doc2.body.document.id;
  const del = await onlineJson(owner, `/api/documents/${doc2Id}`, { method: 'DELETE', company: companyId });
  ok(del.status === 200, `delete invoice online (${del.status} ${JSON.stringify(del.body).slice(0, 120)})`);
  const deep = await desk.call('/api/local/main/sync', { method: 'POST', main: true, body: JSON.stringify({ action: 'deep' }) });
  ok(!deep.body.status.lastError, `deep reconcile (${deep.body.status.lastError || 'ok'})`);
  const localDocs = (await desk.call('/api/documents?type=SALE')).body;
  ok(!(localDocs.documents || localDocs).some((d: any) => d.id === doc2Id), 'online delete reached desktop');
  ok((localDocs.documents || localDocs).some((d: any) => d.id === doc1.body.document.id), 'other invoices untouched');
  const ledger = await desk.call('/api/local/main/sync', { method: 'POST', main: true, body: JSON.stringify({ action: 'status' }) });
  ok(ledger.body.status.pending === 0 && !ledger.body.status.failed.length, 'nothing left pending or failed');

  console.log('4. Encrypted backup & restore');
  const plain: Buffer = Buffer.from((await desk.request('export')).data);
  ok(plain.subarray(0, 15).toString() === 'SQLite format 3', 'export produces DB image in memory');
  const master = await deriveMasterKey('BackupPass#1', act.backupSecret);
  const file = encryptBackup(plain, master, { appVersion: 'test', device: 'e2e' });
  ok(!file.includes(Buffer.from('Offline Customer')), 'backup file contains no readable data');
  let wrong = '';
  try {
    decryptBackup(file, await deriveMasterKey('wrong-password', act.backupSecret));
  } catch (e: any) {
    wrong = e.message;
  }
  ok(/Wrong backup password/.test(wrong), 'wrong password is refused');
  let otherLicense = '';
  try {
    decryptBackup(file, await deriveMasterKey('BackupPass#1', crypto.randomBytes(32).toString('hex')));
  } catch (e: any) {
    otherLicense = e.message;
  }
  ok(otherLicense.length > 0, 'right password but other license secret is refused');
  const tampered = Buffer.from(file);
  tampered[tampered.length - 40] ^= 0xff;
  let tamperErr = '';
  try {
    decryptBackup(tampered, master);
  } catch (e: any) {
    tamperErr = e.message;
  }
  ok(/damaged or was modified/.test(tamperErr), 'modified backup is detected');
  ok(keyCheck(master).length === 16, 'key check present');

  await stopDesktop(desk);
  const dataDir2 = path.join(tmp, 'restored');
  const dbKey2 = crypto.randomBytes(32).toString('hex');
  const runtime2 = makeRuntime(dataDir2, check.body.token, licenseKey, dbKey2);
  const restorer = forkEntry(['--restore']);
  const restored = await new Promise<string>((resolve) => {
    restorer.on('message', (m: any) => (m.type === 'restored' || m.type === 'fatal') && resolve(m.type + (m.message ? `: ${m.message}` : '')));
    restorer.send({ type: 'init', runtime: runtime2, port: 0, dev: false, appDir: path.dirname(ENTRY), plain: decryptBackup(file, master) });
  });
  ok(restored === 'restored', `restore into a new encrypted database (${restored})`);
  const desk2 = await startDesktop(runtime2, await freePort());
  const login = await desk2.call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'desk@local.test', password: 'Desk@12345' }) });
  desk2.cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  const rp = (await desk2.call('/api/parties')).body;
  ok((rp.parties || rp).some((p: any) => p.name === 'Offline Customer'), 'restored data readable after login');

  console.log('5. License enforcement');
  desk2.runtime.license.token = act.token.slice(0, -4) + 'AAAA';
  desk2.proc.send({ type: 'runtime', patch: { license: { token: desk2.runtime.license.token } } });
  await new Promise((r) => setTimeout(r, 200));
  const blocked = await desk2.call('/api/parties');
  ok(blocked.status === 402, 'forged token locks the app (402)');
  const page = await desk2.call('/dashboard');
  ok(page.status === 307 && String(page.headers.get('location')).includes('/desktop/locked'), 'pages redirect to lock screen');
  await stopDesktop(desk2);

  const revoke = await onlineJson(admin, `/api/admin/desktop-licenses/${licenseId}`, { method: 'PATCH', body: JSON.stringify({ status: 'REVOKED' }) });
  ok(revoke.status === 200, 'admin revokes license');
  const afterRevoke = await signedPost('/api/desktop/license/check', { fingerprint });
  ok(afterRevoke.body.status === 'LICENSE_REVOKED', 'revoked license reported at next check-in');
  const syncAfter = await signedPost('/api/desktop/sync/pull', { companyId });
  ok(syncAfter.status === 403, 'revoked license cannot sync');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nAll ${passed} checks passed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

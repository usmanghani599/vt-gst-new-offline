/**
 * Desktop side of online sync. Runs inside the embedded server process.
 *
 * Local-first: the app always reads/writes the encrypted local database.
 * Local changes are captured by SQLite triggers into `_sync_outbox` and pushed
 * when internet is available; online changes are pulled and applied locally.
 * When the computer is NOT linked, nothing is tracked and nothing is sent.
 */
import crypto from 'crypto';
import { prisma } from '../db';
import { getRuntime } from './runtime';
import { applyAggregate, deleteRow, getJsonState, getState, getSyncDb, setState, tableOf } from './sqlite-apply';
import { ROOT_BY_MODEL, SYNC_ROOTS, lowerFirst, rootOrder, type WireAggregate } from '../desktop-sync/registry';
import { bucketHashes, bucketOf, companyWhere, loadAggregates } from '../desktop-sync/serialize';

export class SyncClientError extends Error {
  constructor(message: string, public code = 'SYNC_ERROR', public status = 0) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Signed HTTP to the licensing / sync server
// ---------------------------------------------------------------------------

export async function signedPost<T = any>(path: string, body: unknown, timeoutMs = 60_000): Promise<T> {
  const rt = getRuntime();
  if (!rt.device.activationId || !rt.device.privateKeyPem) throw new SyncClientError('This computer is not activated', 'NOT_ACTIVATED');
  const raw = JSON.stringify(body ?? {});
  const ts = String(Date.now());
  const nonce = crypto.randomBytes(16).toString('hex');
  const message = ['POST', path, ts, nonce, crypto.createHash('sha256').update(raw).digest('hex')].join('\n');
  const signature = crypto.sign(null, Buffer.from(message), crypto.createPrivateKey(rt.device.privateKeyPem)).toString('base64url');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(rt.sync.serverUrl.replace(/\/+$/, '') + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vt-activation': rt.device.activationId,
        'x-vt-timestamp': ts,
        'x-vt-nonce': nonce,
        'x-vt-signature': signature,
      },
      body: raw,
      signal: ctrl.signal,
    });
  } catch (e: any) {
    throw new SyncClientError(e?.name === 'AbortError' ? 'Server timed out' : 'No internet connection', 'OFFLINE');
  } finally {
    clearTimeout(timer);
  }
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new SyncClientError(json.error || `Server error ${res.status}`, json.code || 'SERVER_ERROR', res.status);
  return json as T;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface SyncStatus {
  linked: boolean;
  linkedCompanyId: string | null;
  seriesCode: string | null;
  pending: number;
  running: boolean;
  lastSyncAt: string | null;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastReconcileAt: string | null;
  lastError: string | null;
  failed: { model: string; id: string; message: string }[];
}

let running: Promise<unknown> | null = null;

export function pendingCount(): number {
  const row = getSyncDb().prepare('SELECT COUNT(DISTINCT model || root_id) AS n FROM "_sync_outbox"').get();
  return Number(row?.n || 0);
}

export function getSyncStatus(): SyncStatus {
  const rt = getRuntime();
  return {
    linked: Boolean(rt.sync.linkedCompanyId),
    linkedCompanyId: rt.sync.linkedCompanyId,
    seriesCode: rt.sync.seriesCode,
    pending: pendingCount(),
    running: Boolean(running),
    lastSyncAt: getState('sync.lastSyncAt'),
    lastPushAt: getState('sync.lastPushAt'),
    lastPullAt: getState('sync.lastPullAt'),
    lastReconcileAt: getState('sync.lastReconcileAt'),
    lastError: getState('sync.lastError'),
    failed: getJsonState('sync.failed', [] as SyncStatus['failed']),
  };
}

function isPending(model: string, id: string): boolean {
  return Boolean(getSyncDb().prepare('SELECT 1 FROM "_sync_outbox" WHERE model = ? AND root_id = ? LIMIT 1').get(model, id));
}

// ---------------------------------------------------------------------------
// Link / unlink
// ---------------------------------------------------------------------------

export async function listOnlineCompanies(email: string, password: string) {
  return signedPost<{ accountName: string; companies: { id: string; name: string; gstin: string | null }[] }>(
    '/api/desktop/sync/companies',
    { email, password }
  );
}

/** Enqueues every row of the company so it is uploaded on the next sync. */
async function enqueueWholeCompany(companyId: string) {
  const db = getSyncDb();
  const now = Date.now() - 60_000; // already committed: skip the settle window
  const insert = db.prepare('INSERT INTO "_sync_outbox"(model, root_id, at) VALUES (?, ?, ?)');
  for (const spec of SYNC_ROOTS) {
    const rows: { id: string }[] = await (prisma as any)[lowerFirst(spec.model)].findMany({
      where: companyWhere(spec.model, companyId),
      select: { id: true },
    });
    db.transaction(() => rows.forEach((r) => insert.run(spec.model, r.id, now)))();
  }
}

export async function linkCompany(opts: { email: string; password: string; mode: 'upload' | 'download'; companyId: string }) {
  const rt = getRuntime();
  if (!rt.license.payload?.sync) throw new SyncClientError('Online sync is not included in your license.', 'SYNC_NOT_ALLOWED');
  if (rt.sync.linkedCompanyId) throw new SyncClientError('Already linked. Unlink first.', 'ALREADY_LINKED');
  const res = await signedPost<{ linkedCompanyId: string; seriesCode: string; accountName: string }>('/api/desktop/sync/link', opts);

  const db = getSyncDb();
  db.transaction(() => {
    db.prepare('DELETE FROM "_sync_outbox"').run();
    setState('sync.cursors', null);
    setState('sync.logSeq', null);
    setState('sync.failed', null);
    setState('sync.lastError', null);
    setState('sync.linkedCompanyId', res.linkedCompanyId);
    setState('sync.seriesCode', res.seriesCode);
    setState('sync.mode', opts.mode);
    setState('sync.tracking', '1');
  })();
  rt.sync.linkedCompanyId = res.linkedCompanyId;
  rt.sync.seriesCode = res.seriesCode;

  if (opts.mode === 'upload') await enqueueWholeCompany(res.linkedCompanyId);
  return res;
}

export async function unlinkCompany() {
  const rt = getRuntime();
  try {
    await signedPost('/api/desktop/sync/unlink', {});
  } catch (e) {
    if (!(e instanceof SyncClientError) || e.code !== 'OFFLINE') throw e;
  }
  const db = getSyncDb();
  db.transaction(() => {
    db.prepare('DELETE FROM "_sync_outbox"').run();
    for (const k of ['sync.linkedCompanyId', 'sync.cursors', 'sync.logSeq', 'sync.failed', 'sync.lastError', 'sync.mode']) setState(k, null);
    setState('sync.tracking', '0');
    // seriesCode is kept so numbers issued while linked can never be reused.
  })();
  rt.sync.linkedCompanyId = null;
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

async function pushOnce(companyId: string, failed: SyncStatus['failed']): Promise<number> {
  const rt = getRuntime();
  const db = getSyncDb();
  const settleBefore = Date.now() - 3000; // let open transactions finish first
  const rows: { model: string; root_id: string; maxSeq: number; at: number }[] = db
    .prepare(
      `SELECT model, root_id, MAX(seq) AS maxSeq, MAX(at) AS at FROM "_sync_outbox"
       WHERE at < ? GROUP BY model, root_id ORDER BY MIN(seq) LIMIT 200`
    )
    .all(settleBefore);
  if (!rows.length) return 0;

  const byModel = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byModel.has(r.model)) byModel.set(r.model, []);
    byModel.get(r.model)!.push(r);
  }

  const aggregates: WireAggregate[] = [];
  const done: typeof rows = [];
  for (const [model, list] of byModel) {
    if (!ROOT_BY_MODEL[model]) {
      done.push(...list);
      continue;
    }
    const aggs = await loadAggregates(prisma, model, list.map((r) => r.root_id));
    for (const a of aggs) {
      const meta = list.find((r) => r.root_id === a.id)!;
      if (model === 'DocumentSeries' && rt.sync.seriesCode && String(a.data?.prefix || '').startsWith(`${rt.sync.seriesCode}-`)) {
        done.push(meta); // per-device numbering never leaves this computer
        continue;
      }
      if (a.data && model !== 'Company') {
        const owner = await ownerCompany(model, a.data);
        if (owner && owner !== companyId) {
          done.push(meta); // belongs to another (offline-only) company on this computer
          continue;
        }
      }
      a.changedAt = new Date(meta.at).toISOString();
      aggregates.push(a);
    }
    if (model === 'Company') {
      // Only the linked company is ever uploaded.
      for (let i = aggregates.length - 1; i >= 0; i--) {
        if (aggregates[i].model === 'Company' && aggregates[i].id !== companyId) {
          done.push(list.find((r) => r.root_id === aggregates[i].id)!);
          aggregates.splice(i, 1);
        }
      }
    }
  }

  if (aggregates.length) {
    const res = await signedPost<{ results: { model: string; id: string; status: string; message?: string }[] }>(
      '/api/desktop/sync/push',
      { companyId, aggregates },
      180_000
    );
    for (const r of res.results) {
      const meta = rows.find((x) => x.model === r.model && x.root_id === r.id);
      if (!meta) continue;
      if (r.status === 'error') {
        failed.push({ model: r.model, id: r.id, message: r.message || 'error' });
        // keep it for the next attempt, but do not block the queue
        db.prepare('UPDATE "_sync_outbox" SET at = ? WHERE model = ? AND root_id = ? AND seq <= ?').run(
          Date.now() + 10 * 60 * 1000,
          r.model,
          r.id,
          meta.maxSeq
        );
      } else {
        if (r.status === 'conflict') failed.push({ model: r.model, id: r.id, message: 'Changed online after your edit — the online version was kept' });
        done.push(meta);
      }
    }
  }

  const del = db.prepare('DELETE FROM "_sync_outbox" WHERE model = ? AND root_id = ? AND seq <= ?');
  db.transaction(() => done.forEach((d) => del.run(d.model, d.root_id, d.maxSeq)))();
  setState('sync.lastPushAt', new Date().toISOString());
  return rows.length;
}

async function ownerCompany(model: string, data: Record<string, unknown>): Promise<string | null> {
  const spec = ROOT_BY_MODEL[model];
  if (spec.owner.kind === 'company') return (data.companyId as string) || null;
  if (spec.owner.kind === 'self') return data.id as string;
  const parent = await (prisma as any)[lowerFirst(spec.owner.model)].findUnique({ where: { id: data[spec.owner.field] } });
  return parent ? ownerCompany(spec.owner.model, parent) : null;
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

function applyPage(aggs: WireAggregate[], retry: WireAggregate[], failed: SyncStatus['failed']) {
  const db = getSyncDb();
  const work = [...retry, ...aggs].filter((a) => !isPending(a.model, a.id));
  const upserts = work.filter((a) => a.data).sort((a, b) => rootOrder(a.model) - rootOrder(b.model));
  const deletes = work.filter((a) => !a.data).sort((a, b) => rootOrder(b.model) - rootOrder(a.model));
  const leftover: WireAggregate[] = [];

  const tryApply = (a: WireAggregate, phase: 'normal' | 'deferred') => {
    try {
      db.transaction(() => applyAggregate(db, a, phase))();
      return true;
    } catch (e: any) {
      if (phase === 'normal') leftover.push(a);
      else failed.push({ model: a.model, id: a.id, message: String(e?.message || e) });
      return false;
    }
  };

  let queue = upserts;
  for (let pass = 0; pass < 3 && queue.length; pass++) {
    leftover.length = 0;
    const before = queue.length;
    for (const a of queue) tryApply(a, 'normal');
    queue = [...leftover];
    if (queue.length === before) break;
  }
  const stillFailing = [...queue];
  for (const a of upserts) if (!stillFailing.includes(a)) tryApply(a, 'deferred');
  leftover.length = 0;
  for (const a of deletes) tryApply(a, 'normal');
  return [...stillFailing, ...leftover];
}

/** Deletes local rows of "full set" models that no longer exist online. */
function applyFullSets(companyId: string, fullModels: string[], aggs: WireAggregate[]) {
  const db = getSyncDb();
  for (const model of fullModels) {
    const spec = ROOT_BY_MODEL[model];
    if (spec.owner.kind !== 'company') continue;
    const online = new Set(aggs.filter((a) => a.model === model).map((a) => a.id));
    const local: { id: string }[] = db.prepare(`SELECT "id" FROM "${tableOf(model)}" WHERE "companyId" = ?`).all(companyId);
    for (const { id } of local) {
      if (online.has(id) || isPending(model, id)) continue;
      try {
        db.transaction(() => deleteRow(db, model, id))();
      } catch {
        /* still referenced locally; reconcile later */
      }
    }
  }
}

async function pullAll(companyId: string, failed: SyncStatus['failed']) {
  let cursors = getJsonState<Record<string, { ts: string; id: string }>>('sync.cursors', {});
  let logSeq = Number(getState('sync.logSeq') || 0);
  let retry: WireAggregate[] = [];
  let fullApplied = false;

  for (let page = 0; page < 500; page++) {
    const res = await signedPost<{
      aggregates: WireAggregate[];
      fullModels: string[];
      cursors: Record<string, { ts: string; id: string }>;
      logSeq: number;
      hasMore: boolean;
    }>('/api/desktop/sync/pull', { companyId, cursors, logSeq, limit: 300 }, 180_000);

    retry = applyPage(res.aggregates, retry, failed);
    if (!fullApplied) {
      applyFullSets(companyId, res.fullModels, res.aggregates);
      fullApplied = true;
    }
    cursors = res.cursors;
    logSeq = res.logSeq;
    setState('sync.cursors', JSON.stringify(cursors));
    setState('sync.logSeq', String(logSeq));
    if (!res.hasMore) break;
  }

  if (retry.length) retry = applyPage([], retry, failed);
  for (const a of retry) failed.push({ model: a.model, id: a.id, message: 'Could not apply (missing related record)' });
  setState('sync.lastPullAt', new Date().toISOString());
}

// ---------------------------------------------------------------------------
// Reconcile (detects deletes and missed edits made online)
// ---------------------------------------------------------------------------

async function reconcileModel(companyId: string, model: string, mode: 'ids' | 'content', failed: SyncStatus['failed']) {
  const spec = ROOT_BY_MODEL[model];
  const delegate = (prisma as any)[lowerFirst(model)];
  const where = companyWhere(model, companyId);
  let entries: { id: string; hash: string }[];
  if (mode === 'ids') {
    entries = ((await delegate.findMany({ where, select: { id: true } })) as { id: string }[]).map((r) => ({ id: r.id, hash: '' }));
  } else {
    const ids = ((await delegate.findMany({ where, select: { id: true } })) as { id: string }[]).map((r) => r.id);
    entries = (await loadAggregates(prisma, model, ids)).map((a) => ({ id: a.id, hash: a.hash! }));
  }
  const res = await signedPost<{ differing: Record<string, { id: string; hash: string }[]> }>(
    '/api/desktop/sync/reconcile',
    { companyId, model, mode, buckets: bucketHashes(entries) },
    300_000
  );
  const local = new Map(entries.map((e) => [e.id, e.hash]));
  const toFetch: string[] = [];
  const toDelete: string[] = [];
  for (const [bucket, serverList] of Object.entries(res.differing)) {
    const serverMap = new Map(serverList.map((e) => [e.id, e.hash]));
    for (const e of serverList) {
      if (!local.has(e.id) || (mode === 'content' && local.get(e.id) !== e.hash)) toFetch.push(e.id);
    }
    for (const [id] of local) {
      if (bucketOf(id) === bucket && !serverMap.has(id)) toDelete.push(id);
    }
  }

  const aggs: WireAggregate[] = [];
  for (let i = 0; i < toFetch.length; i += 500) {
    const r = await signedPost<{ aggregates: WireAggregate[] }>('/api/desktop/sync/fetch', {
      companyId,
      model,
      ids: toFetch.slice(i, i + 500),
    });
    aggs.push(...r.aggregates);
  }
  for (const id of toDelete) aggs.push({ model: spec.model, id, data: null });
  const left = applyPage(aggs, [], failed);
  for (const a of left) failed.push({ model: a.model, id: a.id, message: 'Reconcile could not apply change' });
}

async function reconcileAll(companyId: string, mode: 'ids' | 'content', failed: SyncStatus['failed']) {
  for (const spec of SYNC_ROOTS) {
    if (spec.direction !== 'both' || spec.cursor === null) continue; // full-set models are already exact
    await reconcileModel(companyId, spec.model, mode, failed);
  }
  setState('sync.lastReconcileAt', new Date().toISOString());
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

const RECONCILE_EVERY_MS = 6 * 60 * 60 * 1000;

export async function runSync(opts: { deep?: boolean } = {}): Promise<SyncStatus> {
  if (running) {
    await running.catch(() => {});
    return getSyncStatus();
  }
  const rt = getRuntime();
  const companyId = rt.sync.linkedCompanyId;
  if (!companyId) return getSyncStatus();

  const failed: SyncStatus['failed'] = [];
  running = (async () => {
    try {
      // 1. push local changes (uploads everything right after linking)
      for (let i = 0; i < 200; i++) {
        if ((await pushOnce(companyId, failed)) === 0) break;
      }
      // 2. pull online changes
      await pullAll(companyId, failed);
      // 3. periodically verify (deletes / missed edits)
      const last = getState('sync.lastReconcileAt');
      if (opts.deep) await reconcileAll(companyId, 'content', failed);
      else if (!last || Date.now() - new Date(last).getTime() > RECONCILE_EVERY_MS) await reconcileAll(companyId, 'ids', failed);

      setState('sync.lastSyncAt', new Date().toISOString());
      setState('sync.lastError', null);
    } catch (e: any) {
      setState('sync.lastError', String(e?.message || e));
      if (e instanceof SyncClientError && (e.code === 'NOT_LINKED' || e.code === 'SYNC_NOT_ALLOWED')) {
        rt.sync.linkedCompanyId = null;
        setState('sync.linkedCompanyId', null);
        setState('sync.tracking', '0');
      }
    } finally {
      setState('sync.failed', JSON.stringify(failed.slice(0, 50)));
    }
  })();
  try {
    await running;
  } finally {
    running = null;
  }
  return getSyncStatus();
}

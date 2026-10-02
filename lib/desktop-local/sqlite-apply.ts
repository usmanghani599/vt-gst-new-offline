/**
 * Raw SQLite writer used to apply data that comes FROM the server
 * (pulled changes, reference data). It uses its own connection opened with
 * { vtTracking: false }, so these writes never enter the outbox and are not
 * echoed back. All calls are synchronous: nothing else can interleave.
 */
import { Prisma } from '@prisma/client';
import { getRuntime } from './runtime';
import { ROOT_BY_MODEL, type RootSpec, type WireAggregate } from '../desktop-sync/registry';
import { scalarFields } from '../desktop-sync/serialize';

type Db = any;
let syncDb: Db | null = null;

export function getSyncDb(): Db {
  if (!syncDb) {
    const rt = getRuntime();
    (globalThis as any).__VTGST_DB_KEY__ = rt.dbKey;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require('better-sqlite3');
    syncDb = new Database(rt.dbPath, { vtTracking: false, timeout: 15000 });
  }
  return syncDb;
}

export function closeSyncDb() {
  if (syncDb) {
    try {
      syncDb.close();
    } catch {
      /* ignore */
    }
    syncDb = null;
  }
}

export function tableOf(model: string): string {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model);
  if (!m) throw new Error(`Unknown model ${model}`);
  return m.dbName || m.name;
}

/** JSON wire value -> SQLite storage value, matching what Prisma's adapter writes. */
function toSqlite(type: string, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  switch (type) {
    case 'DateTime':
      return new Date(String(v)).toISOString().replace('Z', '+00:00');
    case 'Boolean':
      return v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
    case 'Decimal':
      return String(v);
    case 'Int':
      return Math.trunc(Number(v));
    case 'BigInt':
      return BigInt(String(v));
    case 'Float':
      return Number(v);
    case 'Bytes':
      return Buffer.from(String(v), 'base64');
    default:
      return String(v);
  }
}

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;
const stmtCache = new Map<string, any>();
function stmt(db: Db, sql: string) {
  let s = stmtCache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    stmtCache.set(sql, s);
  }
  return s;
}

export function upsertRow(db: Db, model: string, data: Record<string, unknown>) {
  const fields = scalarFields(model).filter((f) => f.name in data);
  const cols = fields.map((f) => q(f.name));
  const updates = fields.filter((f) => f.name !== 'id').map((f) => `${q(f.name)}=excluded.${q(f.name)}`);
  const sql =
    `INSERT INTO ${q(tableOf(model))} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')}) ` +
    `ON CONFLICT("id") DO ${updates.length ? 'UPDATE SET ' + updates.join(',') : 'NOTHING'}`;
  stmt(db, sql).run(...fields.map((f) => toSqlite(f.type, data[f.name])));
}

export function deleteRow(db: Db, model: string, id: string) {
  stmt(db, `DELETE FROM ${q(tableOf(model))} WHERE "id" = ?`).run(id);
}

function exists(db: Db, model: string, id: string): boolean {
  return Boolean(stmt(db, `SELECT 1 FROM ${q(tableOf(model))} WHERE "id" = ?`).get(id));
}

function localAccountId(db: Db): string | null {
  const row = stmt(db, 'SELECT "id" FROM "accounts" ORDER BY "createdAt" ASC LIMIT 1').get();
  return row ? row.id : null;
}

/** Applies one aggregate (root + owned children). Throws on FK/unique errors. */
export function applyAggregate(db: Db, agg: WireAggregate, phase: 'normal' | 'deferred' = 'normal') {
  const spec: RootSpec | undefined = ROOT_BY_MODEL[agg.model];
  if (!spec) throw new Error(`Model ${agg.model} not syncable`);

  if (phase === 'normal') {
    if (!agg.data) {
      deleteRow(db, spec.model, agg.id);
      return;
    }
    const data: Record<string, unknown> = { ...agg.data, id: agg.id };
    if (spec.model === 'Company') {
      const existing = stmt(db, 'SELECT "accountId" FROM "companies" WHERE "id" = ?').get(agg.id);
      data.accountId = existing?.accountId ?? localAccountId(db);
      if (!data.accountId) throw new Error('No local account to attach the company to');
    }
    for (const f of spec.userRefFields || []) {
      if (data[f] && !exists(db, 'User', String(data[f]))) data[f] = null;
    }
    upsertRow(db, spec.model, data);
  }

  for (const c of spec.children || []) {
    if ((phase === 'deferred') !== Boolean(c.deferred)) continue;
    const rows = agg.children?.[c.relation] || [];
    const keep = rows.map((r) => String(r.id));
    const table = q(tableOf(c.model));
    if (keep.length) {
      db.prepare(`DELETE FROM ${table} WHERE ${q(c.fk)} = ? AND "id" NOT IN (${keep.map(() => '?').join(',')})`).run(agg.id, ...keep);
    } else {
      stmt(db, `DELETE FROM ${table} WHERE ${q(c.fk)} = ?`).run(agg.id);
    }
    for (const r of rows) upsertRow(db, c.model, { ...r, [c.fk]: agg.id });
  }
}

/** Imports platform reference data (countries, states, tax engine, system units). */
export function importReferenceData(order: string[], data: Record<string, Record<string, unknown>[]>) {
  const db = getSyncDb();
  const run = db.transaction(() => {
    for (const model of order) {
      for (const row of data[model] || []) upsertRow(db, model, row);
    }
  });
  run();
  return Object.fromEntries(order.map((m) => [m, (data[m] || []).length]));
}

// ---------------- small key/value state (encrypted DB) ----------------

export function getState(key: string): string | null {
  const row = stmt(getSyncDb(), 'SELECT value FROM "_desktop_state" WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setState(key: string, value: string | null) {
  const db = getSyncDb();
  if (value === null) stmt(db, 'DELETE FROM "_desktop_state" WHERE key = ?').run(key);
  else stmt(db, 'INSERT INTO "_desktop_state"(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function getJsonState<T>(key: string, fallback: T): T {
  const v = getState(key);
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

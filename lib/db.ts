/**
 * DESKTOP VERSION (desktop-owned; not overwritten by sync-upstream).
 *
 * Same export surface as the online lib/db.ts, but backed by an encrypted
 * local SQLite database through Prisma's better-sqlite3 driver adapter.
 * The client is created lazily so `next build` never loads the native module.
 */
import { PrismaClient } from '@prisma/client';
import { getRuntime } from './desktop-local/runtime';

const globalForPrisma = globalThis as unknown as { __vtgstPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const rt = getRuntime();
  (globalThis as any).__VTGST_DB_KEY__ = rt.dbKey;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaBetterSQLite3 } = require('@prisma/adapter-better-sqlite3');
  const adapter = new PrismaBetterSQLite3({ url: `file:${rt.dbPath}`, timeout: 10000 });
  return new PrismaClient({ adapter, log: ['error'] } as any);
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__vtgstPrisma) globalForPrisma.__vtgstPrisma = createClient();
  return globalForPrisma.__vtgstPrisma;
}

/** Closes the connection (used before restore / shutdown). */
export async function disconnectPrisma() {
  const c = globalForPrisma.__vtgstPrisma;
  globalForPrisma.__vtgstPrisma = undefined;
  if (c) await c.$disconnect();
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma() as any;
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default prisma;

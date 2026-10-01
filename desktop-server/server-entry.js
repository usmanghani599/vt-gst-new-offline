'use strict';
/**
 * Entry point of the embedded VTGST server, started by the Electron main
 * process with utilityProcess.fork(). It never reads secrets from env/argv:
 * everything arrives over the private parentPort channel.
 *
 * Modes (argv[2]):
 *   (none)     apply migrations, then run the Next.js server
 *   --restore  replace the database with a decrypted backup, then exit
 *
 * Messages from main:
 *   { type: 'init', runtime, port, dev, appDir }
 *   { type: 'runtime', patch }            live updates (license, sync link)
 *   { type: 'export', id }                -> { type: 'export-result', id, data | error }
 *   { type: 'shutdown' }
 */
const fs = require('fs');
const path = require('path');

const port = process.parentPort;
const mode = process.argv[2] || 'serve';
let runtime = null;

function send(msg) {
  try {
    port.postMessage(msg);
  } catch {
    /* parent gone */
  }
}

function log(...args) {
  send({ type: 'log', message: args.map(String).join(' ') });
}

function openDb(dbPath, options) {
  const Database = require('better-sqlite3'); // the cipher shim
  return new Database(dbPath, options || {});
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

function migrationsDir(appDir) {
  const candidates = [path.join(appDir, 'migrations'), path.join(__dirname, '..', 'migrations'), path.join(__dirname, 'migrations')];
  return candidates.find((d) => fs.existsSync(path.join(d, 'desktop.sql')));
}

function migrate(rt, appDir) {
  const dir = migrationsDir(appDir);
  if (!dir) throw new Error('Migrations folder not found');
  const isNew = !fs.existsSync(rt.dbPath);
  const db = openDb(rt.dbPath);
  try {
    db.exec('CREATE TABLE IF NOT EXISTS "_desktop_migrations" ("name" TEXT NOT NULL PRIMARY KEY, "appliedAt" TEXT NOT NULL)');
    const applied = new Set(db.prepare('SELECT name FROM "_desktop_migrations"').all().map((r) => r.name));
    const pending = fs
      .readdirSync(dir)
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .sort()
      .filter((f) => !applied.has(f));

    if (pending.length && !isNew) {
      // Safety copy (still encrypted) before changing the schema of existing data.
      db.pragma('wal_checkpoint(TRUNCATE)');
      const backup = `${rt.dbPath}.pre-${pending[0].slice(0, 4)}-${Date.now()}.bak`;
      fs.copyFileSync(rt.dbPath, backup);
      log(`Pre-migration safety copy: ${path.basename(backup)}`);
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      log(`Applying migration ${file}`);
      db.exec('PRAGMA foreign_keys = OFF');
      db.exec('BEGIN');
      try {
        db.exec(sql.replace(/^\s*PRAGMA\s+(defer_)?foreign_keys\s*=\s*\w+;?\s*$/gim, ''));
        db.prepare('INSERT INTO "_desktop_migrations"(name, appliedAt) VALUES (?, ?)').run(file, new Date().toISOString());
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${e.message}`);
      } finally {
        db.exec('PRAGMA foreign_keys = ON');
      }
      const problems = db.prepare('PRAGMA foreign_key_check').all();
      if (problems.length) log(`Warning: ${problems.length} foreign key issue(s) after ${file}`);
    }

    db.exec(fs.readFileSync(path.join(dir, 'desktop.sql'), 'utf8'));

    // Online-sync link state lives inside the encrypted database.
    const get = (k) => {
      const r = db.prepare('SELECT value FROM "_desktop_state" WHERE key = ?').get(k);
      return r ? r.value : null;
    };
    rt.sync.linkedCompanyId = get('sync.linkedCompanyId');
    rt.sync.seriesCode = get('sync.seriesCode');
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Backup export / restore
// ---------------------------------------------------------------------------

/** Plain SQLite image of the database (only ever kept in memory). */
function exportDatabase(rt) {
  const db = openDb(rt.dbPath, { readonly: true, fileMustExist: true });
  try {
    const buf = db.serialize();
    // Mark as rollback-journal so it can be opened from memory.
    buf[18] = 1;
    buf[19] = 1;
    return buf;
  } finally {
    db.close();
  }
}

/** Writes a plain SQLite image into a NEW encrypted database without ever touching disk unencrypted. */
function restoreDatabase(rt, plain) {
  const { Base, applyKey } = require('better-sqlite3');
  const header = Buffer.from(plain.subarray(0, 16)).toString('latin1');
  if (!header.startsWith('SQLite format 3')) throw new Error('Backup content is not a VTGST database');

  const mem = new Base(Buffer.from(plain));
  const tables = mem.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'companies'").all();
  if (!tables.length) throw new Error('Backup does not contain VTGST data');

  const target = `${rt.dbPath}.restore-${Date.now()}`;
  mem.pragma("cipher='sqlcipher'");
  mem.pragma('legacy=4');
  mem.exec(`ATTACH DATABASE '${target.replace(/'/g, "''")}' AS enc KEY "x'${rt.dbKey}'"`);
  const objects = mem
    .prepare("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'")
    .all();
  const tablesFirst = objects.filter((o) => o.type === 'table');
  // A consistent snapshot is copied table by table; FK order does not matter here.
  mem.pragma('foreign_keys = OFF');
  mem.exec('BEGIN');
  for (const t of tablesFirst) {
    mem.exec(t.sql.replace(/^CREATE TABLE\s+(IF NOT EXISTS\s+)?("[^"]+"|\S+)/i, (m, ine, name) => `CREATE TABLE enc.${name}`));
  }
  for (const t of tablesFirst) mem.exec(`INSERT INTO enc."${t.name.replace(/"/g, '""')}" SELECT * FROM main."${t.name.replace(/"/g, '""')}"`);
  for (const o of objects.filter((x) => x.type === 'index')) {
    mem.exec(o.sql.replace(/^CREATE\s+(UNIQUE\s+)?INDEX\s+(IF NOT EXISTS\s+)?("[^"]+"|\S+)/i, (m, u, ine, name) => `CREATE ${u || ''}INDEX enc.${name}`));
  }
  mem.exec('COMMIT');
  // Triggers/views are recreated by desktop.sql on next start.
  mem.exec('DETACH DATABASE enc');
  mem.close();

  // Verify the new file opens with the key.
  const check = openDb(target);
  check.prepare('SELECT count(*) AS n FROM companies').get();
  check.close();

  for (const suffix of ['-wal', '-shm']) {
    try {
      fs.unlinkSync(rt.dbPath + suffix);
    } catch {
      /* none */
    }
  }
  if (fs.existsSync(rt.dbPath)) fs.renameSync(rt.dbPath, `${rt.dbPath}.before-restore-${Date.now()}.bak`);
  fs.renameSync(target, rt.dbPath);
}

// ---------------------------------------------------------------------------
// Next.js server
// ---------------------------------------------------------------------------

async function startNext(cfg) {
  process.env.NODE_ENV = cfg.dev ? 'development' : 'production';
  process.env.NEXT_TELEMETRY_DISABLED = '1';
  if (cfg.dev) {
    const { startServer } = require(require.resolve('next/dist/server/lib/start-server', { paths: [cfg.appDir] }));
    await startServer({ dir: cfg.appDir, port: cfg.port, hostname: '127.0.0.1', isDev: true, allowRetry: false });
  } else {
    process.env.PORT = String(cfg.port);
    process.env.HOSTNAME = '127.0.0.1';
    require(path.join(cfg.appDir, 'server.js'));
  }
}

port.on('message', async (e) => {
  const msg = e.data || {};
  try {
    if (msg.type === 'init') {
      runtime = msg.runtime;
      globalThis.__VTGST_DB_KEY__ = runtime.dbKey;
      globalThis.__VTGST_DESKTOP__ = runtime;
      fs.mkdirSync(runtime.dataDir, { recursive: true });
      fs.mkdirSync(runtime.filesDir, { recursive: true });

      if (mode === '--restore') {
        restoreDatabase(runtime, msg.plain);
        send({ type: 'restored' });
        setTimeout(() => process.exit(0), 50);
        return;
      }

      migrate(runtime, msg.appDir);
      await startNext({ port: msg.port, dev: msg.dev, appDir: msg.appDir });
      send({ type: 'started' });
    } else if (msg.type === 'runtime' && runtime) {
      const p = msg.patch || {};
      for (const k of Object.keys(p)) {
        if (p[k] && typeof p[k] === 'object' && !Array.isArray(p[k]) && runtime[k] && typeof runtime[k] === 'object') {
          Object.assign(runtime[k], p[k]);
        } else {
          runtime[k] = p[k];
        }
      }
    } else if (msg.type === 'export' && runtime) {
      try {
        send({ type: 'export-result', id: msg.id, data: exportDatabase(runtime) });
      } catch (err) {
        send({ type: 'export-result', id: msg.id, error: err.message });
      }
    } else if (msg.type === 'shutdown') {
      process.exit(0);
    }
  } catch (err) {
    send({ type: 'fatal', message: err && err.message ? err.message : String(err) });
  }
});

process.on('uncaughtException', (err) => log('uncaught', err && err.stack ? err.stack : err));
process.on('unhandledRejection', (err) => log('unhandled', err && err.stack ? err.stack : err));

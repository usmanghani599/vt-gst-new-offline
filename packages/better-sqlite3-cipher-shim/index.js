'use strict';
/**
 * Drop-in replacement for `better-sqlite3` that transparently opens every
 * database file with SQLCipher (AES-256) encryption via
 * better-sqlite3-multiple-ciphers.
 *
 * Prisma's @prisma/adapter-better-sqlite3 does `new Database(path)`; this shim
 * is installed under the name `better-sqlite3` (see package.json overrides), so
 * Prisma only ever sees the encrypted database.
 *
 * The key is taken from (in order):
 *   options.key (hex)  ->  globalThis.__VTGST_DB_KEY__  ->  error
 * It is never read from environment variables in production builds.
 *
 * Every connection registers vt_tracking(), used by the sync outbox triggers.
 * Pass { vtTracking: false } for connections that apply remote changes, so
 * those writes are not echoed back to the server.
 */
const Base = require('better-sqlite3-multiple-ciphers');

function resolveKey(options) {
  if (options && typeof options.key === 'string') return options.key;
  if (typeof globalThis.__VTGST_DB_KEY__ === 'string') return globalThis.__VTGST_DB_KEY__;
  return null;
}

function applyKey(db, hexKey) {
  if (!/^[0-9a-f]{64}$/i.test(hexKey)) throw new Error('Invalid database key');
  db.pragma(`cipher='sqlcipher'`);
  db.pragma('legacy=4');
  db.pragma(`key="x'${hexKey}'"`);
}

class CipherDatabase extends Base {
  constructor(filename, options) {
    const opts = Object.assign({}, options || {});
    const tracking = opts.vtTracking !== false;
    const explicitKey = opts.key;
    delete opts.vtTracking;
    delete opts.key;
    super(filename, opts);

    const isFile = typeof filename === 'string' && filename !== '' && filename !== ':memory:';
    if (isFile) {
      const key = resolveKey({ key: explicitKey });
      if (!key) {
        this.close();
        throw new Error('VTGST: database key not provisioned');
      }
      applyKey(this, key);
      // Fails fast with "file is not a database" on a wrong key.
      this.prepare('SELECT count(*) FROM sqlite_master').get();
      if (!opts.readonly) {
        this.pragma('journal_mode = WAL');
        this.pragma('synchronous = NORMAL');
      }
      this.pragma('foreign_keys = ON');
      this.pragma('busy_timeout = 10000');
    }
    this.function('vt_tracking', { deterministic: false }, () => (tracking ? 1 : 0));
  }
}

module.exports = CipherDatabase;
module.exports.default = CipherDatabase;
module.exports.SqliteError = Base.SqliteError;
module.exports.applyKey = applyKey;
module.exports.Base = Base;

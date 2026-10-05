import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Preferences } from '@capacitor/preferences';
import {
  createContext,
  createLocalApi,
  createPbkdf2Hasher,
  Kysely,
  migrateSqlite,
  sql,
  type Database,
  type SessionStore,
} from '@finora/core';
import { capacitorSqliteDialect } from './capacitorSqlite';
import type { FinanceApi } from './types';

const DB_NAME = 'finora';
const SESSION_KEY = 'finora-session-user';

/** 256-bit random passphrase for SQLCipher. */
function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Opens (creating on first launch) the encrypted on-device database.
 * The SQLCipher passphrase is generated once and kept by the plugin in the
 * iOS Keychain / Android Keystore-backed storage — never in JavaScript storage.
 */
async function openDatabase() {
  const sqlite = new SQLiteConnection(CapacitorSQLite);

  if (!(await sqlite.isSecretStored()).result) {
    await sqlite.setEncryptionSecret(randomSecret());
  }

  const exists = (await sqlite.isConnection(DB_NAME, false)).result;
  const connection = exists
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, true, 'secret', 1, false);
  await connection.open();
  // Must be set per connection, outside a transaction
  await connection.execute('PRAGMA foreign_keys = ON;', false);
  return connection;
}

/** The session only remembers which local account is signed in (it is not a credential). */
const session: SessionStore = {
  get: async () => (await Preferences.get({ key: SESSION_KEY })).value,
  set: async (userId) => {
    if (userId) await Preferences.set({ key: SESSION_KEY, value: userId });
    else await Preferences.remove({ key: SESSION_KEY });
  },
};

/** Mobile build: the shared core runs inside the app against on-device SQLite — no network needed. */
export async function createMobileApi(): Promise<FinanceApi> {
  const connection = await openDatabase();
  const db = new Kysely<Database>({ dialect: capacitorSqliteDialect(connection) });

  // Each migration runs in a transaction: an update either fully applies or leaves the data untouched
  await migrateSqlite(db);
  await sql`PRAGMA foreign_keys = ON`.execute(db);

  const ctx = createContext({ db, dialect: 'sqlite', hasher: createPbkdf2Hasher() });
  return createLocalApi(ctx, session, { onError: (err) => console.error(err) });
}

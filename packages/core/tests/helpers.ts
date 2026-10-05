import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { Kysely, SqliteDialect } from 'kysely';
import { createContext, createLocalApi, createPbkdf2Hasher, migrateSqlite, type Database as Schema, type SessionStore } from '../src';

/** A fresh in-memory SQLite database with the app schema, plus a context and local API. */
export async function createTestApp(options: { now?: () => Date } = {}) {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = new Kysely<Schema>({ dialect: new SqliteDialect({ database: sqlite }) });
  await migrateSqlite(db);

  // Few iterations keep the tests fast; production uses the default
  const ctx = createContext({ db, dialect: 'sqlite', hasher: createPbkdf2Hasher(1000), newId: randomUUID, now: options.now });

  let current: string | null = null;
  const session: SessionStore = {
    get: async () => current,
    set: async (id) => {
      current = id;
    },
  };
  const api = createLocalApi(ctx, session, { onError: (err) => console.error(err) });
  return { sqlite, db, ctx, api, session };
}

export const isoDay = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

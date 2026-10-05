import type { Kysely } from 'kysely';
import type { Database, DB } from './db/schema';

export type Dialect = 'postgres' | 'sqlite';

/** Password hashing is injected: bcrypt on the server, PBKDF2 (Web Crypto) on devices. */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

/** Everything a service needs from its environment. */
export interface CoreContext {
  db: DB;
  dialect: Dialect;
  hasher: PasswordHasher;
  /** New primary key (UUID). */
  newId: () => string;
  /** Current time (injectable for tests). */
  now: () => Date;
}

export interface CreateContextOptions {
  db: Kysely<Database>;
  dialect: Dialect;
  hasher: PasswordHasher;
  newId?: () => string;
  now?: () => Date;
}

export function createContext(options: CreateContextOptions): CoreContext {
  return {
    db: options.db,
    dialect: options.dialect,
    hasher: options.hasher,
    newId: options.newId ?? (() => globalThis.crypto.randomUUID()),
    now: options.now ?? (() => new Date()),
  };
}

/** Runs `fn` inside a database transaction (or the current one, if already inside). */
export async function inTransaction<T>(ctx: CoreContext, fn: (ctx: CoreContext) => Promise<T>): Promise<T> {
  if (ctx.db.isTransaction) return fn(ctx);
  return (ctx.db as Kysely<Database>).transaction().execute((trx) => fn({ ...ctx, db: trx }));
}

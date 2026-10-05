import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { createContext, Kysely, PostgresDialect, type Database, type PasswordHasher } from '@finora/core';
import { env } from './env';

// Read values in the shapes the shared core expects (the same shapes SQLite returns):
pg.types.setTypeParser(pg.types.builtins.INT8, Number); // bigint paise / COUNT(*) → number
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number); // SUM(bigint) → number
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value); // DATE → 'YYYY-MM-DD'
// TIMESTAMP(3) columns hold UTC → ISO-8601 string
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value: string) => new Date(`${value.replace(' ', 'T')}Z`).toISOString());

/** Prisma-style `?schema=` is not a libpq option; map it to the search_path instead. */
function poolConfig(url: string): pg.PoolConfig {
  const parsed = new URL(url);
  const schema = parsed.searchParams.get('schema');
  parsed.searchParams.delete('schema');
  return {
    connectionString: parsed.toString(),
    max: 10,
    ...(schema && schema !== 'public' ? { options: `-c search_path=${schema}` } : {}),
  };
}

export const pool = new pg.Pool(poolConfig(env.DATABASE_URL));

export const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });

const SALT_ROUNDS = 12;

export const bcryptHasher: PasswordHasher = {
  hash: (password) => bcrypt.hash(password, SALT_ROUNDS),
  verify: (password, hash) => bcrypt.compare(password, hash),
};

/** Shared context for every request: PostgreSQL + bcrypt. */
export const core = createContext({ db, dialect: 'postgres', hasher: bcryptHasher, newId: randomUUID });

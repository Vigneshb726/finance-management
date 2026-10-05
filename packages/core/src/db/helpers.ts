import { sql, type Expression, type RawBuilder, type SqlBool } from 'kysely';
import type { Dialect } from '../context';

/** Escapes LIKE wildcards so user input is matched literally. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Case-insensitive "contains". PostgreSQL uses ILIKE; SQLite's LIKE is already
 * case-insensitive for ASCII text.
 */
export function containsInsensitive(dialect: Dialect, column: Expression<unknown>, term: string): RawBuilder<SqlBool> {
  const pattern = `%${escapeLike(term)}%`;
  return dialect === 'postgres'
    ? sql<SqlBool>`${column} ILIKE ${pattern} ESCAPE '\\'`
    : sql<SqlBool>`${column} LIKE ${pattern} ESCAPE '\\'`;
}

/** Case-insensitive equality (lower() works the same in both databases). */
export function equalsInsensitive(column: Expression<unknown>, value: string): RawBuilder<SqlBool> {
  return sql<SqlBool>`lower(${column}) = lower(${value})`;
}

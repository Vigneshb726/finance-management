/**
 * Runs the full offline API through the Capacitor SQLite Kysely driver, with the
 * native plugin replaced by a stand-in that has the same async query/run/execute
 * contract (backed by real SQLite). Verifies statement routing, transactions,
 * serialised access and rollback — everything except the native bridge itself.
 */
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { describe, expect, it } from 'vitest';
import { createContext, createLocalApi, createPbkdf2Hasher, Kysely, migrateSqlite, type Database as Schema } from '@finora/core';
import { capacitorSqliteDialect } from './capacitorSqlite';

function fakePlugin() {
  const sqlite = new Database(':memory:');
  const statements: string[] = [];
  const conn = {
    async query(statement: string, values: unknown[] = []) {
      statements.push(statement);
      await new Promise((r) => setTimeout(r, 0)); // async like the native bridge
      return { values: sqlite.prepare(statement).all(...values) };
    },
    async run(statement: string, values: unknown[] = [], transaction = true) {
      statements.push(statement);
      if (transaction) throw new Error('driver must pass transaction=false');
      await new Promise((r) => setTimeout(r, 0));
      const result = sqlite.prepare(statement).run(...values);
      return { changes: { changes: result.changes, lastId: Number(result.lastInsertRowid) } };
    },
    async execute(statements: string) {
      sqlite.exec(statements);
      return { changes: { changes: 0 } };
    },
    async close() {
      sqlite.close();
    },
  };
  return { conn: conn as unknown as SQLiteDBConnection, sqlite, statements };
}

async function setup() {
  const plugin = fakePlugin();
  await plugin.conn.execute('PRAGMA foreign_keys = ON;', false);
  const db = new Kysely<Schema>({ dialect: capacitorSqliteDialect(plugin.conn) });
  await migrateSqlite(db);
  const ctx = createContext({ db, dialect: 'sqlite', hasher: createPbkdf2Hasher(1000), newId: randomUUID });
  let session: string | null = null;
  const api = createLocalApi(ctx, { get: async () => session, set: async (id) => void (session = id) });
  return { ...plugin, db, api };
}

describe('Capacitor SQLite driver', () => {
  it('runs the offline API end to end', async () => {
    const { api } = await setup();
    await api.auth.register({ name: 'Mobile User', email: 'm@example.com', password: 'Test@12345' });
    const categories = await api.categories.list();
    const food = categories.find((c) => c.name === 'Food')!;
    const salary = categories.find((c) => c.name === 'Salary')!;

    const today = new Date().toISOString().slice(0, 10);
    // Fired concurrently: the driver must serialise access to the single native connection
    await Promise.all([
      api.transactions.create({ type: 'INCOME', amount: 1000.1, categoryId: salary.id, description: 'Pay', date: today }),
      api.transactions.create({ type: 'EXPENSE', amount: 250.2, categoryId: food.id, description: 'Lunch', date: today }),
      api.budgets.create({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)), totalAmount: 300 }),
    ]);

    const list = await api.transactions.list({});
    expect(list.pagination.total).toBe(2);
    expect(list.totals).toEqual({ income: 1000.1, expense: 250.2, net: 749.9 });

    const summary = await api.analytics.summary({});
    expect(summary.budget).toMatchObject({ spent: 250.2, status: 'WARNING' });
    expect((await api.notifications.list()).data.some((n) => n.type === 'BUDGET_WARNING')).toBe(true);
  });

  it('commits multi-statement work atomically and rolls back on failure', async () => {
    const { api, statements } = await setup();
    await api.auth.register({ name: 'Mobile User', email: 'm@example.com', password: 'Test@12345' });
    const backup = await api.backup.create();
    expect(statements).toContain('BEGIN');
    expect(statements).toContain('COMMIT');

    const before = (await api.categories.list()).length;
    const broken = { ...backup, transactions: [{ ...backup.categories[0], bogus: true }] };
    await expect(api.backup.restore(broken)).rejects.toMatchObject({ status: 400 });

    // A failure inside the restore transaction must leave the data untouched
    const restorable = JSON.parse(JSON.stringify(backup));
    restorable.budgets = [{ id: 'b1', month: 1, year: 2026, totalAmount: 100, notes: null, createdAt: backup.exportedAt, updatedAt: backup.exportedAt, categories: [] }, { id: 'b2', month: 1, year: 2026, totalAmount: 100, notes: null, createdAt: backup.exportedAt, updatedAt: backup.exportedAt, categories: [] }];
    await expect(api.backup.restore(restorable)).rejects.toMatchObject({ status: 409 });
    expect(statements).toContain('ROLLBACK');
    expect((await api.categories.list()).length).toBe(before);
  });
});

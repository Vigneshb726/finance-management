/**
 * The offline (SQLite) API end to end — the same scenarios the server's
 * PostgreSQL API tests cover, plus recurring transactions, CSV, backup and reports.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { ApiError, SQLITE_MIGRATIONS, TABLE_COLUMNS, type BackupFile, type LocalApi } from '../src';
import { createTestApp, isoDay } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

const now = new Date();
const year = now.getUTCFullYear();
const month = now.getUTCMonth() + 1;
const day = (d: number) => isoDay(year, month, d);
const email = 'local@example.com';
const password = 'Test@12345';

let app: Awaited<ReturnType<typeof createTestApp>>;
let api: LocalApi;
let foodId = '';
let salaryId = '';

const expectError = async (promise: Promise<unknown>, status: number) => {
  const err = await promise.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).status).toBe(status);
  return err as ApiError;
};

beforeAll(async () => {
  app = await createTestApp();
  api = app.api;
});

describe('schema', () => {
  it('matches the shared column list for every table', () => {
    for (const [table, columns] of Object.entries(TABLE_COLUMNS)) {
      const actual = app.sqlite.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[];
      expect(actual.map((c) => c.name).sort(), table).toEqual(Object.keys(columns).sort());
    }
  });

  it('records applied migrations', async () => {
    const rows = app.sqlite.prepare('SELECT id FROM _migrations').all() as { id: string }[];
    expect(rows.map((r) => r.id)).toEqual(SQLITE_MIGRATIONS.map((m) => m.id));
  });
});

describe('auth', () => {
  it('rejects weak passwords with field errors', async () => {
    const err = await expectError(api.auth.register({ name: 'Test', email, password: 'short' }), 400);
    expect(err.body.errors?.[0].field).toBe('password');
  });

  it('registers, logs in and never returns the password hash', async () => {
    const reg = await api.auth.register({ name: 'Local User', email, password });
    expect((reg.user as any).passwordHash).toBeUndefined();
    await expectError(api.auth.register({ name: 'Local User', email, password }), 409);

    await api.auth.logout();
    await expectError(api.auth.me(), 401);
    await expectError(api.auth.login({ email, password: 'Wrong@1234' }), 401);

    const login = await api.auth.login({ email: 'LOCAL@example.com', password });
    expect(login.user).toMatchObject({ email, currency: 'INR', notifyBudgetAlerts: true });
    expect(await api.auth.me()).toMatchObject({ email });
  });
});

describe('categories', () => {
  it('provides default categories and supports custom ones', async () => {
    const list = await api.categories.list();
    const names = list.filter((c) => c.type === 'EXPENSE').map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(['Food', 'Transport', 'Shopping', 'Education', 'Bills', 'Entertainment', 'Health', 'Travel', 'Rent', 'Other']),
    );
    expect(list[0].type).toBe('INCOME');
    foodId = list.find((c) => c.name === 'Food')!.id;
    salaryId = list.find((c) => c.name === 'Salary')!.id;

    const pets = await api.categories.create({ name: 'Pets', color: '#123456' });
    await expectError(api.categories.create({ name: 'pets' }), 409);
    await expectError(api.categories.remove(foodId), 400);

    await api.transactions.create({ type: 'EXPENSE', amount: 100, categoryId: pets.id, description: 'Dog food', date: day(1) });
    expect(await api.categories.remove(pets.id)).toEqual({ reassignedTransactions: 1, reassignedTo: 'Other' });
  });
});

describe('transactions, budgets and dashboard calculations', () => {
  let budgetId = '';

  it('creates a budget with category limits', async () => {
    const budget = await api.budgets.create({ month, year, totalAmount: 20000, categories: [{ categoryId: foodId, amount: 5000 }] });
    budgetId = budget.id;
    await expectError(api.budgets.create({ month, year, totalAmount: 100 }), 409);
    await expectError(
      api.budgets.update(budgetId, { month, year, totalAmount: 1000, categories: [{ categoryId: foodId, amount: 5000 }] }),
      400,
    );
  });

  it('validates transactions', async () => {
    await expectError(api.transactions.create({ type: 'EXPENSE', amount: -5, categoryId: foodId, description: 'x', date: day(2) }), 400);
    await expectError(api.transactions.create({ type: 'INCOME', amount: 5, categoryId: foodId, description: 'x', date: day(2) }), 400);
  });

  it('updates totals immediately after create / edit / delete', async () => {
    await api.transactions.create({ type: 'INCOME', amount: 45000, categoryId: salaryId, description: 'Salary', date: day(1), paymentMethod: 'BANK_TRANSFER' });
    const tx = await api.transactions.create({ type: 'EXPENSE', amount: 3750, categoryId: foodId, description: 'Groceries', date: day(2), paymentMethod: 'UPI' });
    expect(tx).toMatchObject({ amount: 3750, date: day(2), category: { name: 'Food' } });

    let summary = await api.analytics.summary({ year, month });
    expect(summary.totalBalance).toBe(41150);
    expect(summary.month.netSavings).toBe(41150);
    expect(summary.budget!.categories.find((c) => c.categoryId === foodId)).toMatchObject({
      amount: 5000, spent: 3750, remaining: 1250, usage: 75, status: 'ON_TRACK',
    });

    await api.transactions.update(tx.id, { type: 'EXPENSE', amount: 6000, categoryId: foodId, description: 'Groceries', date: day(2), paymentMethod: 'UPI' });
    summary = await api.analytics.summary({ year, month });
    expect(summary.budget!.categories.find((c) => c.categoryId === foodId)!.status).toBe('EXCEEDED');
    expect(summary.totalBalance).toBe(38900);

    const notifications = await api.notifications.list();
    expect(notifications.data.some((n) => n.type === 'BUDGET_EXCEEDED')).toBe(true);

    await api.transactions.remove(tx.id);
    summary = await api.analytics.summary({ year, month });
    expect(summary.totalBalance).toBe(44900);
  });

  it('keeps paise exact', async () => {
    const a = await api.transactions.create({ type: 'EXPENSE', amount: 0.1, categoryId: foodId, description: 'Tiny', date: day(3) });
    const b = await api.transactions.create({ type: 'EXPENSE', amount: 0.2, categoryId: foodId, description: 'Tiny', date: day(3) });
    const list = await api.transactions.list({ search: 'tiny' });
    expect(list.totals.expense).toBe(0.3);
    await api.transactions.remove(a.id);
    await api.transactions.remove(b.id);
  });

  it('lists with search, filters, sorting and pagination', async () => {
    const res = await api.transactions.list({ type: 'INCOME', search: 'SAL', pageSize: 5, sortBy: 'amount' });
    expect(res.data).toHaveLength(1);
    expect(res.pagination).toMatchObject({ page: 1, pageSize: 5, total: 1, totalPages: 1 });
    expect(res.totals.income).toBe(45000);

    // LIKE wildcards in the search are matched literally
    expect((await api.transactions.list({ search: '%' })).data).toHaveLength(0);
  });

  it('returns analytics series', async () => {
    const monthly = await api.analytics.monthly({ months: 6 });
    expect(monthly).toHaveLength(6);
    expect(monthly[5]).toMatchObject({ income: 45000, expense: 100, savings: 44900, budget: 20000 });

    const cats = await api.analytics.categories({ type: 'EXPENSE' });
    expect(cats.total).toBe(100);

    const daily = await api.analytics.daily({ year, month });
    expect(daily[0]).toMatchObject({ day: 1, income: 45000, expense: 100, cumulativeExpense: 100 });
  });
});

describe('goals', () => {
  it('computes progress and raises milestone notifications', async () => {
    const goal = await api.goals.create({ name: 'New Laptop', targetAmount: 80000, currentAmount: 35000 });
    expect(goal).toMatchObject({ progress: 43.75, remaining: 45000, status: 'IN_PROGRESS' });

    await expectError(api.goals.contribute(goal.id, -50000), 400);
    const updated = await api.goals.contribute(goal.id, 45000);
    expect(updated).toMatchObject({ progress: 100, status: 'COMPLETED' });

    const notifications = await api.notifications.list();
    expect(notifications.data.filter((n) => n.type === 'GOAL_MILESTONE')).toHaveLength(2);
  });
});

describe('recurring transactions', () => {
  it('back-fills missed occurrences once and never duplicates them', async () => {
    const start = isoDay(year, month, 1);
    const rule = await api.recurring.create({
      type: 'EXPENSE', amount: 999, categoryId: foodId, description: 'Meal plan', frequency: 'DAILY', startDate: start,
      endDate: isoDay(year, month, 3),
    });
    const today = now.getUTCDate();
    const expected = Math.min(today, 3);
    expect(rule.occurrenceCount).toBe(expected);
    expect(rule.status).toBe(today >= 3 ? 'COMPLETED' : 'ACTIVE');

    const generated = await api.transactions.list({ search: 'Meal plan', pageSize: 50 });
    expect(generated.pagination.total).toBe(expected);
    expect(generated.data.every((t) => t.recurringId === rule.id)).toBe(true);

    // Editing the amount does not re-create past occurrences
    await api.recurring.update(rule.id, {
      type: 'EXPENSE', amount: 500, categoryId: foodId, description: 'Meal plan', frequency: 'DAILY', startDate: start,
      endDate: isoDay(year, month, 3),
    });
    expect((await api.transactions.list({ search: 'Meal plan' })).pagination.total).toBe(expected);

    // Deleting the rule keeps the transactions it created
    await api.recurring.remove(rule.id);
    const kept = await api.transactions.list({ search: 'Meal plan' });
    expect(kept.pagination.total).toBe(expected);
    expect(kept.data[0].recurringId).toBeNull();
    for (const t of kept.data) await api.transactions.remove(t.id);
  });

  it('schedules future rules without creating anything yet', async () => {
    const rule = await api.recurring.create({
      type: 'INCOME', amount: 45000, categoryId: salaryId, description: 'Salary (recurring)', frequency: 'MONTHLY',
      startDate: isoDay(year + 1, 1, 31),
    });
    expect(rule).toMatchObject({ occurrenceCount: 0, nextDate: isoDay(year + 1, 1, 31), status: 'ACTIVE' });
    expect((await api.recurring.list()).some((r) => r.id === rule.id)).toBe(true);
    await api.recurring.remove(rule.id);
  });
});

describe('CSV export and monthly report', () => {
  it('exports filtered transactions as CSV', async () => {
    const { content, count, filename } = await api.transactions.exportCsv({ type: 'INCOME' });
    expect(filename).toMatch(/^finora-transactions-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(count).toBe(1);
    const lines = content.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Date,Type,Category,Description,Amount,Signed amount,Payment method,Notes,Recurring');
    expect(lines[1]).toBe(`${day(1)},Income,Salary,Salary,45000.00,45000.00,Bank transfer,,No`);
  });

  it('builds the monthly report', async () => {
    const report = await api.reports.monthly({ year, month });
    expect(report.summary).toMatchObject({ income: 45000, expenses: 100, netSavings: 44900 });
    expect(report.expenseCategories.data[0]).toMatchObject({ name: 'Other', total: 100 });
    expect(report.budget).toMatchObject({ amount: 20000, spent: 100 });
    expect(report.transactions).toMatchObject({ count: 2, incomeCount: 1, expenseCount: 1 });
    expect(report.trend).toHaveLength(6);
  });
});

describe('backup and restore', () => {
  let backup: BackupFile;

  it('round-trips all data into another account with new ids', async () => {
    backup = await api.backup.create();
    expect(backup).toMatchObject({ app: 'finora', amountsIn: 'paise' });
    expect(backup.transactions.find((t) => t.description === 'Salary')!.amount).toBe(4500000);

    const before = await api.analytics.summary({ year, month });
    await api.auth.logout();
    await api.auth.register({ name: 'Second User', email: 'second@example.com', password });

    const counts = await api.backup.restore(JSON.parse(JSON.stringify(backup)));
    expect(counts.transactions).toBe(backup.transactions.length);

    const after = await api.analytics.summary({ year, month });
    expect(after.totalBalance).toBe(before.totalBalance);
    expect(after.budget).toMatchObject({ amount: before.budget!.amount, spent: before.budget!.spent });
    expect((await api.goals.list())[0]).toMatchObject({ name: 'New Laptop', progress: 100 });

    const ids = new Set(backup.transactions.map((t) => t.id));
    const restored = await api.transactions.list({ pageSize: 100 });
    expect(restored.data.some((t) => ids.has(t.id))).toBe(false);
  });

  it('rejects invalid or inconsistent files without touching data', async () => {
    const countBefore = (await api.transactions.list({})).pagination.total;
    await expectError(api.backup.restore({ hello: 'world' }), 400);
    const broken = JSON.parse(JSON.stringify(backup));
    broken.transactions[0].categoryId = 'missing';
    await expectError(api.backup.restore(broken), 400);
    expect((await api.transactions.list({})).pagination.total).toBe(countBefore);
  });
});

describe('data isolation and account deletion', () => {
  it("prevents access to another user's data", async () => {
    const mine = (await api.transactions.list({})).data[0];
    await api.auth.logout();
    await api.auth.register({ name: 'Third', email: 'third@example.com', password });

    const { id, ...body } = mine as any;
    await expectError(api.transactions.update(id, { ...body, categoryId: mine.categoryId }), 404);
    await expectError(api.transactions.remove(id), 404);
    expect((await api.transactions.list({})).data).toHaveLength(0);
  });

  it('deletes an account and all of its data', async () => {
    await expectError(api.auth.deleteAccount('nope'), 400);
    await api.auth.deleteAccount(password);
    await expectError(api.auth.me(), 401);
    const users = app.sqlite.prepare('SELECT email FROM "User" ORDER BY email').all() as { email: string }[];
    expect(users.map((u) => u.email)).toEqual([email, 'second@example.com']);
  });
});

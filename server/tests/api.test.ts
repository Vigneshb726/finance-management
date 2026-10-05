/**
 * End-to-end API tests against the database in DATABASE_URL.
 * Each run uses a unique throwaway user that is deleted afterwards.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';

/* eslint-disable @typescript-eslint/no-explicit-any */

const app = createApp();
const email = `test-${Date.now()}@example.com`;
const password = 'Test@12345';
let token = '';
const auth = () => ({ Authorization: `Bearer ${token}` });

const now = new Date();
const year = now.getUTCFullYear();
const month = now.getUTCMonth() + 1;
const day = (d: number) => `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

let foodId = '';
let salaryId = '';

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('auth', () => {
  it('rejects weak passwords', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Test', email, password: 'short' });
    expect(res.status).toBe(400);
  });

  it('registers, logs in and never returns the password hash', async () => {
    const reg = await request(app).post('/api/auth/register').send({ name: 'Test User', email, password });
    expect(reg.status).toBe(201);
    expect(reg.body.user.passwordHash).toBeUndefined();

    const dup = await request(app).post('/api/auth/register').send({ name: 'Test User', email, password });
    expect(dup.status).toBe(409);

    const bad = await request(app).post('/api/auth/login').send({ email, password: 'Wrong@1234' });
    expect(bad.status).toBe(401);

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    token = login.body.token;

    const me = await request(app).get('/api/auth/me').set(auth());
    expect(me.body.user).toMatchObject({ email, currency: 'INR' });
  });

  it('protects routes', async () => {
    expect((await request(app).get('/api/transactions')).status).toBe(401);
    expect((await request(app).get('/api/transactions').set({ Authorization: 'Bearer nope' })).status).toBe(401);
  });
});

describe('categories', () => {
  it('provides default categories and supports custom ones', async () => {
    const res = await request(app).get('/api/categories').set(auth());
    const names = res.body.filter((c: any) => c.type === 'EXPENSE').map((c: any) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(['Food', 'Transport', 'Shopping', 'Education', 'Bills', 'Entertainment', 'Health', 'Travel', 'Rent', 'Other']),
    );
    foodId = res.body.find((c: any) => c.name === 'Food').id;
    salaryId = res.body.find((c: any) => c.name === 'Salary').id;

    const created = await request(app).post('/api/categories').set(auth()).send({ name: 'Pets', color: '#123456' });
    expect(created.status).toBe(201);

    const defaultDelete = await request(app).delete(`/api/categories/${foodId}`).set(auth());
    expect(defaultDelete.status).toBe(400);

    await request(app)
      .post('/api/transactions')
      .set(auth())
      .send({ type: 'EXPENSE', amount: 100, categoryId: created.body.id, description: 'Dog food', date: day(1) });
    const del = await request(app).delete(`/api/categories/${created.body.id}`).set(auth());
    expect(del.body).toMatchObject({ reassignedTransactions: 1, reassignedTo: 'Other' });
  });
});

describe('transactions, budgets and dashboard calculations', () => {
  let budgetId = '';
  let txId = '';

  it('creates a budget with category limits', async () => {
    const res = await request(app)
      .post('/api/budgets')
      .set(auth())
      .send({ month, year, totalAmount: 20000, categories: [{ categoryId: foodId, amount: 5000 }] });
    expect(res.status).toBe(201);
    budgetId = res.body.id;

    const overAllocated = await request(app)
      .put(`/api/budgets/${budgetId}`)
      .set(auth())
      .send({ month, year, totalAmount: 1000, categories: [{ categoryId: foodId, amount: 5000 }] });
    expect(overAllocated.status).toBe(400);
  });

  it('validates transactions', async () => {
    const negative = await request(app)
      .post('/api/transactions')
      .set(auth())
      .send({ type: 'EXPENSE', amount: -5, categoryId: foodId, description: 'x', date: day(2) });
    expect(negative.status).toBe(400);

    const wrongType = await request(app)
      .post('/api/transactions')
      .set(auth())
      .send({ type: 'INCOME', amount: 5, categoryId: foodId, description: 'x', date: day(2) });
    expect(wrongType.status).toBe(400);
  });

  it('updates totals immediately after create / edit / delete', async () => {
    await request(app)
      .post('/api/transactions')
      .set(auth())
      .send({ type: 'INCOME', amount: 45000, categoryId: salaryId, description: 'Salary', date: day(1), paymentMethod: 'BANK_TRANSFER' });
    const tx = await request(app)
      .post('/api/transactions')
      .set(auth())
      .send({ type: 'EXPENSE', amount: 3750, categoryId: foodId, description: 'Groceries', date: day(2), paymentMethod: 'UPI' });
    expect(tx.status).toBe(201);
    txId = tx.body.id;

    let summary = (await request(app).get(`/api/analytics/summary?year=${year}&month=${month}`).set(auth())).body;
    // 45000 income − (3750 food + 100 "Other" from the category test)
    expect(summary.totalBalance).toBe(41150);
    expect(summary.month.netSavings).toBe(41150);
    const food = summary.budget.categories.find((c: any) => c.categoryId === foodId);
    expect(food).toMatchObject({ amount: 5000, spent: 3750, remaining: 1250, usage: 75, status: 'ON_TRACK' });

    await request(app)
      .put(`/api/transactions/${txId}`)
      .set(auth())
      .send({ type: 'EXPENSE', amount: 6000, categoryId: foodId, description: 'Groceries', date: day(2), paymentMethod: 'UPI' });
    summary = (await request(app).get(`/api/analytics/summary?year=${year}&month=${month}`).set(auth())).body;
    expect(summary.budget.categories.find((c: any) => c.categoryId === foodId).status).toBe('EXCEEDED');
    expect(summary.totalBalance).toBe(38900);

    const notifications = (await request(app).get('/api/notifications').set(auth())).body;
    expect(notifications.data.some((n: any) => n.type === 'BUDGET_EXCEEDED')).toBe(true);

    await request(app).delete(`/api/transactions/${txId}`).set(auth()).expect(204);
    summary = (await request(app).get(`/api/analytics/summary?year=${year}&month=${month}`).set(auth())).body;
    expect(summary.totalBalance).toBe(44900);
  });

  it('lists with search, filters, sorting and pagination', async () => {
    const res = await request(app).get('/api/transactions?type=INCOME&search=sal&pageSize=5&sortBy=amount').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 5, total: 1, totalPages: 1 });
    expect(res.body.totals.income).toBe(45000);
  });

  it('returns analytics series', async () => {
    const monthly = await request(app).get('/api/analytics/monthly?months=6').set(auth());
    expect(monthly.body).toHaveLength(6);
    expect(monthly.body[5]).toMatchObject({ income: 45000, expense: 100, savings: 44900, budget: 20000 });

    const cats = await request(app).get('/api/analytics/categories?type=EXPENSE').set(auth());
    expect(cats.body.total).toBe(100);
  });
});

describe('goals', () => {
  it('computes progress and raises milestone notifications', async () => {
    const res = await request(app)
      .post('/api/goals')
      .set(auth())
      .send({ name: 'New Laptop', targetAmount: 80000, currentAmount: 35000 });
    expect(res.body).toMatchObject({ progress: 43.75, remaining: 45000, status: 'IN_PROGRESS' });

    const updated = await request(app).post(`/api/goals/${res.body.id}/contribute`).set(auth()).send({ amount: 45000 });
    expect(updated.body).toMatchObject({ progress: 100, status: 'COMPLETED' });

    const notifications = (await request(app).get('/api/notifications').set(auth())).body;
    expect(notifications.data.filter((n: any) => n.type === 'GOAL_MILESTONE')).toHaveLength(2);
  });
});

describe('data isolation', () => {
  it("prevents access to another user's data", async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other', email: `other-${email}`, password });
    const otherAuth = { Authorization: `Bearer ${other.body.token}` };

    const mine = (await request(app).get('/api/transactions').set(auth())).body.data[0];
    expect((await request(app).put(`/api/transactions/${mine.id}`).set(otherAuth).send({ ...mine })).status).toBe(404);
    expect((await request(app).delete(`/api/transactions/${mine.id}`).set(otherAuth)).status).toBe(404);
    expect((await request(app).get('/api/transactions').set(otherAuth)).body.data).toHaveLength(0);

    await prisma.user.deleteMany({ where: { email: `other-${email}` } });
  });
});

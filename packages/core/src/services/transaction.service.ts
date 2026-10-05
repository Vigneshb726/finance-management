import type { ExpressionBuilder, SelectQueryBuilder } from 'kysely';
import type { CoreContext } from '../context';
import { containsInsensitive } from '../db/helpers';
import type { Database } from '../db/schema';
import { AppError } from '../errors';
import type { TransactionType } from '../types';
import { round2 } from '../utils/calculations';
import { yearMonthOf } from '../utils/dates';
import { fromPaise, toPaise } from '../utils/money';
import type { TransactionFilters, TransactionInput, TransactionQuery } from '../validators/schemas';
import { checkBudgetAlerts } from './notification.service';

/** Columns returned for a transaction, including its category. */
const transactionColumns = [
  't.id',
  't.type',
  't.amount',
  't.description',
  't.date',
  't.paymentMethod',
  't.notes',
  't.categoryId',
  't.recurringId',
  't.createdAt',
  't.updatedAt',
  'c.name as categoryName',
  'c.color as categoryColor',
  'c.icon as categoryIcon',
  'c.type as categoryType',
] as const;

type Base = SelectQueryBuilder<Database & { t: Database['Transaction']; c: Database['Category'] }, 't' | 'c', object>;

export function transactionsWithCategory(ctx: CoreContext, userId: string): Base {
  return ctx.db
    .selectFrom('Transaction as t')
    .innerJoin('Category as c', 'c.id', 't.categoryId')
    .where('t.userId', '=', userId) as unknown as Base;
}

export type TransactionRow = Awaited<ReturnType<ReturnType<typeof selectTransactions>['execute']>>[number];

export const selectTransactions = (base: Base) => base.select(transactionColumns);

export function serializeTransaction(t: TransactionRow) {
  return {
    id: t.id,
    type: t.type,
    amount: fromPaise(t.amount),
    description: t.description,
    date: t.date,
    paymentMethod: t.paymentMethod,
    notes: t.notes,
    categoryId: t.categoryId,
    category: { id: t.categoryId, name: t.categoryName, color: t.categoryColor, icon: t.categoryIcon, type: t.categoryType },
    recurringId: t.recurringId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export type SerializedTransaction = ReturnType<typeof serializeTransaction>;

export async function assertCategory(ctx: CoreContext, userId: string, categoryId: string, type: TransactionType) {
  const category = await ctx.db
    .selectFrom('Category')
    .select(['name', 'type'])
    .where('id', '=', categoryId)
    .where('userId', '=', userId)
    .executeTakeFirst();
  if (!category) throw AppError.badRequest('Selected category does not exist');
  if (category.type !== type) {
    throw AppError.badRequest(`"${category.name}" is an ${category.type.toLowerCase()} category`);
  }
}

/** Applies search and filter criteria to a transaction query. */
export function applyFilters(ctx: CoreContext, query: Base, q: Partial<TransactionFilters>): Base {
  let next = query;
  if (q.type) next = next.where('t.type', '=', q.type);
  if (q.categoryId) next = next.where('t.categoryId', '=', q.categoryId);
  if (q.paymentMethod) next = next.where('t.paymentMethod', '=', q.paymentMethod);
  if (q.startDate) next = next.where('t.date', '>=', q.startDate);
  if (q.endDate) next = next.where('t.date', '<=', q.endDate);
  if (q.search) {
    const term = q.search;
    next = next.where((eb: ExpressionBuilder<Database & { t: Database['Transaction']; c: Database['Category'] }, 't' | 'c'>) =>
      eb.or([
        containsInsensitive(ctx.dialect, eb.ref('t.description'), term),
        containsInsensitive(ctx.dialect, eb.ref('t.notes'), term),
        containsInsensitive(ctx.dialect, eb.ref('c.name'), term),
      ]),
    );
  }
  return next;
}

/** Applies the requested sort order (with stable tie-breakers). */
export function applySort(query: Base, q: Pick<TransactionFilters, 'sortBy' | 'sortOrder'>): Base {
  const dir = q.sortOrder;
  switch (q.sortBy) {
    case 'amount':
      return query.orderBy('t.amount', dir).orderBy('t.date', 'desc').orderBy('t.id', 'desc');
    case 'description':
      return query.orderBy('t.description', dir).orderBy('t.date', 'desc').orderBy('t.id', 'desc');
    case 'category':
      return query.orderBy('c.name', dir).orderBy('t.date', 'desc').orderBy('t.id', 'desc');
    case 'createdAt':
      return query.orderBy('t.createdAt', dir).orderBy('t.id', dir);
    default:
      return query.orderBy('t.date', dir).orderBy('t.createdAt', dir).orderBy('t.id', dir);
  }
}

export async function listTransactions(ctx: CoreContext, userId: string, q: TransactionQuery) {
  const filtered = applyFilters(ctx, transactionsWithCategory(ctx, userId), q);

  const [rows, sums] = await Promise.all([
    selectTransactions(applySort(filtered, q))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize)
      .execute(),
    filtered
      .select((eb) => ['t.type', eb.fn.sum<number>('t.amount').as('total'), eb.fn.countAll<number>().as('count')])
      .groupBy('t.type')
      .execute(),
  ]);

  const income = fromPaise(sums.find((s) => s.type === 'INCOME')?.total);
  const expense = fromPaise(sums.find((s) => s.type === 'EXPENSE')?.total);
  const total = sums.reduce((n, s) => n + Number(s.count), 0);

  return {
    data: rows.map(serializeTransaction),
    pagination: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    },
    totals: { income: round2(income), expense: round2(expense), net: round2(income - expense) },
  };
}

/** Every transaction matching the filters (used for CSV export), capped for safety. */
export async function findTransactions(ctx: CoreContext, userId: string, q: TransactionFilters, limit = 50_000) {
  const rows = await selectTransactions(applySort(applyFilters(ctx, transactionsWithCategory(ctx, userId), q), q))
    .limit(limit)
    .execute();
  return rows.map(serializeTransaction);
}

export async function getTransaction(ctx: CoreContext, userId: string, id: string) {
  const row = await selectTransactions(transactionsWithCategory(ctx, userId).where('t.id', '=', id)).executeTakeFirst();
  if (!row) throw AppError.notFound('Transaction');
  return serializeTransaction(row);
}

export async function createTransaction(ctx: CoreContext, userId: string, input: TransactionInput) {
  await assertCategory(ctx, userId, input.categoryId, input.type);
  const id = ctx.newId();
  const now = ctx.now().toISOString();
  await ctx.db
    .insertInto('Transaction')
    .values({
      id,
      userId,
      type: input.type,
      amount: toPaise(input.amount),
      description: input.description,
      date: input.date,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      categoryId: input.categoryId,
      recurringId: null,
      createdAt: now,
      updatedAt: now,
    })
    .execute();
  if (input.type === 'EXPENSE') await alertForDate(ctx, userId, input.date);
  return getTransaction(ctx, userId, id);
}

export async function updateTransaction(ctx: CoreContext, userId: string, id: string, input: TransactionInput) {
  const existing = await ctx.db
    .selectFrom('Transaction')
    .select('id')
    .where('id', '=', id)
    .where('userId', '=', userId)
    .executeTakeFirst();
  if (!existing) throw AppError.notFound('Transaction');

  await assertCategory(ctx, userId, input.categoryId, input.type);
  await ctx.db
    .updateTable('Transaction')
    .set({
      type: input.type,
      amount: toPaise(input.amount),
      description: input.description,
      date: input.date,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      categoryId: input.categoryId,
      updatedAt: ctx.now().toISOString(),
    })
    .where('id', '=', id)
    .where('userId', '=', userId)
    .execute();
  if (input.type === 'EXPENSE') await alertForDate(ctx, userId, input.date);
  return getTransaction(ctx, userId, id);
}

export async function deleteTransaction(ctx: CoreContext, userId: string, id: string) {
  const result = await ctx.db
    .deleteFrom('Transaction')
    .where('id', '=', id)
    .where('userId', '=', userId)
    .executeTakeFirst();
  if (Number(result.numDeletedRows) === 0) throw AppError.notFound('Transaction');
}

/** Re-evaluates budget alerts for the month containing `date`. */
export async function alertForDate(ctx: CoreContext, userId: string, date: string) {
  const { year, month } = yearMonthOf(date);
  await checkBudgetAlerts(ctx, userId, year, month);
}

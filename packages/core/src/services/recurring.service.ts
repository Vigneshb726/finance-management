import type { Selectable } from 'kysely';
import { inTransaction, type CoreContext } from '../context';
import { dbBool, type RecurringTransactionTable } from '../db/schema';
import { AppError } from '../errors';
import type { RecurrenceFrequency } from '../types';
import { addDays, daysInMonth, monthKey, shiftMonth, todayDateOnly, yearMonthOf } from '../utils/dates';
import { fromPaise, toPaise } from '../utils/money';
import type { RecurringInput } from '../validators/schemas';
import { checkBudgetAlerts } from './notification.service';
import { assertCategory } from './transaction.service';

type RuleRow = Selectable<RecurringTransactionTable>;

/** Most occurrences generated for one rule in one pass (a 1-day rule left alone for ~3 years). */
const MAX_CATCH_UP = 1000;

/**
 * Date of the k-th occurrence (k = 0 is the start date). Computed from the start
 * date every time, so a rule starting on the 31st stays on month-ends instead of
 * drifting to the 28th after February.
 */
export function occurrenceDate(start: string, frequency: RecurrenceFrequency, interval: number, k: number): string {
  switch (frequency) {
    case 'DAILY':
      return addDays(start, k * interval);
    case 'WEEKLY':
      return addDays(start, 7 * k * interval);
    case 'MONTHLY':
    case 'YEARLY': {
      const { year, month } = yearMonthOf(start);
      const day = Number(start.slice(8, 10));
      const shifted = shiftMonth(year, month, (frequency === 'YEARLY' ? 12 : 1) * k * interval);
      const d = Math.min(day, daysInMonth(shifted.year, shifted.month));
      return `${monthKey(shifted.year, shifted.month)}-${String(d).padStart(2, '0')}`;
    }
  }
}

/** First occurrence index whose date is on or after `date`. */
function firstIndexOnOrAfter(rule: Pick<RuleRow, 'startDate' | 'frequency' | 'interval'>, date: string): number {
  let k = 0;
  while (occurrenceDate(rule.startDate, rule.frequency, rule.interval, k) < date && k < 100_000) k++;
  return k;
}

function serializeRule(rule: RuleRow & { categoryName: string; categoryColor: string; categoryIcon: string }) {
  const active = !!rule.isActive;
  return {
    id: rule.id,
    type: rule.type,
    amount: fromPaise(rule.amount),
    description: rule.description,
    categoryId: rule.categoryId,
    category: { id: rule.categoryId, name: rule.categoryName, color: rule.categoryColor, icon: rule.categoryIcon },
    paymentMethod: rule.paymentMethod,
    notes: rule.notes,
    frequency: rule.frequency,
    interval: rule.interval,
    startDate: rule.startDate,
    endDate: rule.endDate,
    nextDate: active ? rule.nextDate : null,
    occurrenceCount: rule.occurrenceCount,
    isActive: active,
    status: (!rule.nextDate ? 'COMPLETED' : active ? 'ACTIVE' : 'PAUSED') as 'COMPLETED' | 'ACTIVE' | 'PAUSED',
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

const rulesWithCategory = (ctx: CoreContext, userId: string) =>
  ctx.db
    .selectFrom('RecurringTransaction as r')
    .innerJoin('Category as c', 'c.id', 'r.categoryId')
    .selectAll('r')
    .select(['c.name as categoryName', 'c.color as categoryColor', 'c.icon as categoryIcon'])
    .where('r.userId', '=', userId);

export async function listRecurring(ctx: CoreContext, userId: string) {
  const rules = await rulesWithCategory(ctx, userId)
    .orderBy('r.isActive', 'desc')
    .orderBy((eb) => eb.case().when('r.nextDate', 'is', null).then(eb.lit(1)).else(eb.lit(0)).end())
    .orderBy('r.nextDate', 'asc')
    .orderBy('r.description', 'asc')
    .execute();
  return rules.map(serializeRule);
}

export async function getRecurring(ctx: CoreContext, userId: string, id: string) {
  const rule = await rulesWithCategory(ctx, userId).where('r.id', '=', id).executeTakeFirst();
  if (!rule) throw AppError.notFound('Recurring transaction');
  return serializeRule(rule);
}

async function findOwned(ctx: CoreContext, userId: string, id: string) {
  const rule = await ctx.db
    .selectFrom('RecurringTransaction')
    .selectAll()
    .where('id', '=', id)
    .where('userId', '=', userId)
    .executeTakeFirst();
  if (!rule) throw AppError.notFound('Recurring transaction');
  return rule;
}

/** Next occurrence index/date for a schedule, given what has already been generated. */
function schedule(
  rule: Pick<RuleRow, 'startDate' | 'frequency' | 'interval' | 'endDate'>,
  fromDate: string | null,
): { occurrenceCount: number; nextDate: string | null } {
  const k = fromDate ? firstIndexOnOrAfter(rule, fromDate) : 0;
  const next = occurrenceDate(rule.startDate, rule.frequency, rule.interval, k);
  return { occurrenceCount: k, nextDate: rule.endDate && next > rule.endDate ? null : next };
}

export async function createRecurring(ctx: CoreContext, userId: string, input: RecurringInput) {
  await assertCategory(ctx, userId, input.categoryId, input.type);
  const id = ctx.newId();
  const now = ctx.now().toISOString();
  const next = schedule(input, null);

  await ctx.db
    .insertInto('RecurringTransaction')
    .values({
      id,
      userId,
      type: input.type,
      amount: toPaise(input.amount),
      description: input.description,
      categoryId: input.categoryId,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      frequency: input.frequency,
      interval: input.interval,
      startDate: input.startDate,
      endDate: input.endDate,
      nextDate: next.nextDate,
      occurrenceCount: next.occurrenceCount,
      isActive: dbBool(input.isActive),
      createdAt: now,
      updatedAt: now,
    })
    .execute();

  await processDueRecurring(ctx, userId);
  return getRecurring(ctx, userId, id);
}

export async function updateRecurring(ctx: CoreContext, userId: string, id: string, input: RecurringInput) {
  const existing = await findOwned(ctx, userId, id);
  await assertCategory(ctx, userId, input.categoryId, input.type);

  const today = todayDateOnly(ctx.now());
  const scheduleChanged =
    existing.startDate !== input.startDate ||
    existing.frequency !== input.frequency ||
    existing.interval !== input.interval ||
    existing.endDate !== input.endDate;
  const resumed = !existing.isActive && input.isActive;

  let next: { occurrenceCount: number; nextDate: string | null } = {
    occurrenceCount: existing.occurrenceCount,
    nextDate: existing.nextDate,
  };
  if (scheduleChanged) {
    // Continue after the last generated occurrence so nothing is created twice
    const last = await ctx.db
      .selectFrom('Transaction')
      .select((eb) => eb.fn.max('date').as('date'))
      .where('recurringId', '=', id)
      .executeTakeFirst();
    next = schedule(input, last?.date ? addDays(last.date, 1) : null);
  }
  if (resumed && next.nextDate && next.nextDate < today) {
    // A paused rule resumes from today instead of back-filling the paused period
    next = schedule(input, today);
  }

  await ctx.db
    .updateTable('RecurringTransaction')
    .set({
      type: input.type,
      amount: toPaise(input.amount),
      description: input.description,
      categoryId: input.categoryId,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      frequency: input.frequency,
      interval: input.interval,
      startDate: input.startDate,
      endDate: input.endDate,
      nextDate: next.nextDate,
      occurrenceCount: next.occurrenceCount,
      isActive: dbBool(input.isActive),
      updatedAt: ctx.now().toISOString(),
    })
    .where('id', '=', id)
    .where('userId', '=', userId)
    .execute();

  await processDueRecurring(ctx, userId);
  return getRecurring(ctx, userId, id);
}

/** Deletes a rule. Transactions it already created are kept. */
export async function deleteRecurring(ctx: CoreContext, userId: string, id: string) {
  await findOwned(ctx, userId, id);
  await inTransaction(ctx, async (tx) => {
    await tx.db.updateTable('Transaction').set({ recurringId: null }).where('recurringId', '=', id).execute();
    await tx.db.deleteFrom('RecurringTransaction').where('id', '=', id).where('userId', '=', userId).execute();
  });
}

/**
 * Creates every occurrence that has come due (including ones missed while the app
 * was closed). Safe to call often and concurrently: a unique (recurringId, date)
 * index prevents duplicates. Returns the number of transactions created.
 */
export async function processDueRecurring(ctx: CoreContext, userId: string): Promise<number> {
  const today = todayDateOnly(ctx.now());
  const due = await ctx.db
    .selectFrom('RecurringTransaction')
    .selectAll()
    .where('userId', '=', userId)
    .where('isActive', '=', dbBool(true))
    .where('nextDate', 'is not', null)
    .where('nextDate', '<=', today)
    .execute();
  if (!due.length) return 0;

  let created = 0;
  const expenseMonths = new Set<string>();

  for (const rule of due) {
    await inTransaction(ctx, async (tx) => {
      let k = rule.occurrenceCount;
      let date: string | null = rule.nextDate;
      let generated = 0;
      const now = tx.now().toISOString();

      while (date && date <= today && generated < MAX_CATCH_UP) {
        if (rule.endDate && date > rule.endDate) {
          date = null;
          break;
        }
        const result = await tx.db
          .insertInto('Transaction')
          .values({
            id: tx.newId(),
            userId,
            type: rule.type,
            amount: rule.amount,
            description: rule.description,
            date,
            paymentMethod: rule.paymentMethod,
            notes: rule.notes,
            categoryId: rule.categoryId,
            recurringId: rule.id,
            createdAt: now,
            updatedAt: now,
          })
          .onConflict((oc) => oc.columns(['recurringId', 'date']).doNothing())
          .executeTakeFirst();
        if (Number(result.numInsertedOrUpdatedRows ?? 0) > 0) {
          created++;
          if (rule.type === 'EXPENSE') expenseMonths.add(date.slice(0, 7));
        }
        generated++;
        k++;
        date = occurrenceDate(rule.startDate, rule.frequency, rule.interval, k);
      }
      if (date && rule.endDate && date > rule.endDate) date = null;

      await tx.db
        .updateTable('RecurringTransaction')
        .set({ occurrenceCount: k, nextDate: date, updatedAt: now })
        .where('id', '=', rule.id)
        .execute();
    });
  }

  for (const ym of expenseMonths) {
    const { year, month } = yearMonthOf(`${ym}-01`);
    await checkBudgetAlerts(ctx, userId, year, month);
  }
  return created;
}

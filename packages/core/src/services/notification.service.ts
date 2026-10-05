import type { CoreContext } from '../context';
import { dbBool } from '../db/schema';
import { AppError } from '../errors';
import type { NotificationType } from '../types';
import { crossedMilestones, percentage, round2 } from '../utils/calculations';
import { currentYearMonth, monthBounds, monthKey, monthName, shiftMonth } from '../utils/dates';
import { formatCurrency } from '../utils/format';
import { fromPaise } from '../utils/money';
import type { NotificationQuery } from '../validators/schemas';
import { getBudgetUsageForMonth } from './budgetUsage.service';

interface NewNotification {
  type: NotificationType;
  title: string;
  message: string;
  dedupeKey: string | null;
}

/** Inserts notifications, silently skipping any whose dedupe key already exists. */
export async function createNotifications(ctx: CoreContext, userId: string, items: NewNotification[]) {
  if (!items.length) return;
  const createdAt = ctx.now().toISOString();
  await ctx.db
    .insertInto('Notification')
    .values(items.map((n) => ({ ...n, id: ctx.newId(), userId, isRead: dbBool(false), createdAt })))
    .onConflict((oc) => oc.columns(['userId', 'dedupeKey']).doNothing())
    .execute();
}

async function getPreferences(ctx: CoreContext, userId: string) {
  const user = await ctx.db
    .selectFrom('User')
    .select(['currency', 'notifyBudgetAlerts', 'notifyGoalMilestones', 'notifyMonthlySummary'])
    .where('id', '=', userId)
    .executeTakeFirst();
  if (!user) return null;
  return {
    currency: user.currency,
    budgetAlerts: !!user.notifyBudgetAlerts,
    goalMilestones: !!user.notifyGoalMilestones,
    monthlySummary: !!user.notifyMonthlySummary,
  };
}

/**
 * Evaluates the budget for a month and raises "almost exceeded" (≥ 80%) and
 * "exceeded" (> 100%) alerts, once per scope.
 */
export async function checkBudgetAlerts(ctx: CoreContext, userId: string, year: number, month: number) {
  const prefs = await getPreferences(ctx, userId);
  if (!prefs?.budgetAlerts) return;

  const budget = await getBudgetUsageForMonth(ctx, userId, year, month);
  if (!budget) return;

  const period = `${monthName(month)} ${year}`;
  const fmt = (n: number) => formatCurrency(n, prefs.currency);
  const items: NewNotification[] = [];

  const scopes = [
    { key: 'total', label: 'monthly budget', usage: budget },
    ...budget.categories.map((c) => ({ key: c.categoryId, label: `${c.category.name} budget`, usage: c })),
  ];

  for (const { key, label, usage } of scopes) {
    if (usage.status === 'EXCEEDED') {
      items.push({
        type: 'BUDGET_EXCEEDED',
        title: `${capitalize(label)} exceeded`,
        message: `You've spent ${fmt(usage.spent)} of your ${fmt(usage.amount)} ${label} for ${period} (${usage.usage}%).`,
        dedupeKey: `budget:${budget.id}:${key}:exceeded`,
      });
    } else if (usage.status === 'WARNING') {
      items.push({
        type: 'BUDGET_WARNING',
        title: `${capitalize(label)} almost used`,
        message: `You've used ${usage.usage}% of your ${label} for ${period}. ${fmt(usage.remaining)} left.`,
        dedupeKey: `budget:${budget.id}:${key}:warning`,
      });
    }
  }

  await createNotifications(ctx, userId, items);
}

/** Raises a notification for the highest savings milestone newly reached. */
export async function checkGoalMilestones(
  ctx: CoreContext,
  userId: string,
  goal: { id: string; name: string },
  progressBefore: number,
  progressAfter: number,
) {
  const crossed = crossedMilestones(progressBefore, progressAfter);
  if (!crossed.length) return;

  const prefs = await getPreferences(ctx, userId);
  if (!prefs?.goalMilestones) return;

  const milestone = crossed[crossed.length - 1];
  await createNotifications(ctx, userId, [
    {
      type: 'GOAL_MILESTONE',
      title: milestone === 100 ? `Goal achieved: ${goal.name} 🎉` : `${milestone}% of "${goal.name}" saved`,
      message:
        milestone === 100
          ? `Congratulations! You've fully funded your "${goal.name}" goal.`
          : `Great progress — you've reached ${milestone}% of your "${goal.name}" savings goal.`,
      dedupeKey: `goal:${goal.id}:${milestone}`,
    },
  ]);
}

/** Creates a one-time summary for the previous month (lazily, when notifications are fetched). */
export async function ensureMonthlySummary(ctx: CoreContext, userId: string) {
  const prefs = await getPreferences(ctx, userId);
  if (!prefs?.monthlySummary) return;

  const now = currentYearMonth(ctx.now());
  const prev = shiftMonth(now.year, now.month, -1);
  const dedupeKey = `summary:${monthKey(prev.year, prev.month)}`;

  const existing = await ctx.db
    .selectFrom('Notification')
    .select('id')
    .where('userId', '=', userId)
    .where('dedupeKey', '=', dedupeKey)
    .executeTakeFirst();
  if (existing) return;

  const { start, end } = monthBounds(prev.year, prev.month);
  const groups = await ctx.db
    .selectFrom('Transaction')
    .select((eb) => ['type', eb.fn.sum<number>('amount').as('total')])
    .where('userId', '=', userId)
    .where('date', '>=', start)
    .where('date', '<', end)
    .groupBy('type')
    .execute();
  const income = fromPaise(groups.find((g) => g.type === 'INCOME')?.total);
  const expense = fromPaise(groups.find((g) => g.type === 'EXPENSE')?.total);
  if (income === 0 && expense === 0) return;

  const net = round2(income - expense);
  const fmt = (n: number) => formatCurrency(n, prefs.currency);
  await createNotifications(ctx, userId, [
    {
      type: 'MONTHLY_SUMMARY',
      title: `${monthName(prev.month)} ${prev.year} summary`,
      message: `Income ${fmt(income)} · Expenses ${fmt(expense)} · Net savings ${fmt(net)} (savings rate ${percentage(Math.max(net, 0), income)}%).`,
      dedupeKey,
    },
  ]);
}

const notificationColumns = ['id', 'type', 'title', 'message', 'isRead', 'createdAt'] as const;

const serialize = <T extends { isRead: unknown }>(n: T) => ({ ...n, isRead: !!n.isRead });

export async function listNotifications(ctx: CoreContext, userId: string, opts: NotificationQuery) {
  await ensureMonthlySummary(ctx, userId);

  let query = ctx.db.selectFrom('Notification').select(notificationColumns).where('userId', '=', userId);
  if (opts.unreadOnly) query = query.where('isRead', '=', dbBool(false));

  const [data, unread] = await Promise.all([
    query.orderBy('createdAt', 'desc').orderBy('id', 'desc').limit(opts.limit).execute(),
    ctx.db
      .selectFrom('Notification')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('userId', '=', userId)
      .where('isRead', '=', dbBool(false))
      .executeTakeFirstOrThrow(),
  ]);
  return { data: data.map(serialize), unreadCount: Number(unread.count) };
}

export async function markRead(ctx: CoreContext, userId: string, id: string) {
  const result = await ctx.db
    .updateTable('Notification')
    .set({ isRead: dbBool(true) })
    .where('id', '=', id)
    .where('userId', '=', userId)
    .executeTakeFirst();
  if (Number(result.numUpdatedRows) === 0) throw AppError.notFound('Notification');
  const row = await ctx.db.selectFrom('Notification').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  return serialize(row);
}

export async function markAllRead(ctx: CoreContext, userId: string) {
  const result = await ctx.db
    .updateTable('Notification')
    .set({ isRead: dbBool(true) })
    .where('userId', '=', userId)
    .where('isRead', '=', dbBool(false))
    .executeTakeFirst();
  return { updated: Number(result.numUpdatedRows) };
}

export async function deleteNotification(ctx: CoreContext, userId: string, id: string) {
  const result = await ctx.db
    .deleteFrom('Notification')
    .where('id', '=', id)
    .where('userId', '=', userId)
    .executeTakeFirst();
  if (Number(result.numDeletedRows) === 0) throw AppError.notFound('Notification');
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

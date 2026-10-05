import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { crossedMilestones, round2, percentage } from '../utils/calculations';
import { currentYearMonth, monthKey, monthName, monthRange, shiftMonth } from '../utils/dates';
import { formatCurrency } from '../utils/format';
import { getBudgetUsageForMonth } from './budgetUsage.service';

interface NewNotification {
  type: NotificationType;
  title: string;
  message: string;
  dedupeKey: string;
}

async function createUnique(userId: string, items: NewNotification[]) {
  if (!items.length) return;
  await prisma.notification.createMany({
    data: items.map((n) => ({ ...n, userId })),
    skipDuplicates: true,
  });
}

/**
 * Evaluates the budget for the month containing `date` and raises
 * "almost exceeded" (≥ 80%) and "exceeded" (> 100%) alerts, once per scope.
 */
export async function checkBudgetAlerts(userId: string, date: Date) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifyBudgetAlerts: true, currency: true },
  });
  if (!user?.notifyBudgetAlerts) return;

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const budget = await getBudgetUsageForMonth(userId, year, month);
  if (!budget) return;

  const period = `${monthName(month)} ${year}`;
  const fmt = (n: number) => formatCurrency(n, user.currency);
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

  await createUnique(userId, items);
}

/** Raises a notification for the highest savings milestone newly reached. */
export async function checkGoalMilestones(
  userId: string,
  goal: { id: string; name: string },
  progressBefore: number,
  progressAfter: number,
) {
  const crossed = crossedMilestones(progressBefore, progressAfter);
  if (!crossed.length) return;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notifyGoalMilestones: true } });
  if (!user?.notifyGoalMilestones) return;

  const milestone = crossed[crossed.length - 1];
  await createUnique(userId, [
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
export async function ensureMonthlySummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifyMonthlySummary: true, currency: true },
  });
  if (!user?.notifyMonthlySummary) return;

  const now = currentYearMonth();
  const prev = shiftMonth(now.year, now.month, -1);
  const dedupeKey = `summary:${monthKey(prev.year, prev.month)}`;

  const existing = await prisma.notification.findUnique({
    where: { userId_dedupeKey: { userId, dedupeKey } },
    select: { id: true },
  });
  if (existing) return;

  const { start, end } = monthRange(prev.year, prev.month);
  const groups = await prisma.transaction.groupBy({
    by: ['type'],
    where: { userId, date: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  const income = groups.find((g) => g.type === 'INCOME')?._sum.amount?.toNumber() ?? 0;
  const expense = groups.find((g) => g.type === 'EXPENSE')?._sum.amount?.toNumber() ?? 0;
  if (income === 0 && expense === 0) return;

  const net = round2(income - expense);
  const fmt = (n: number) => formatCurrency(n, user.currency);
  await createUnique(userId, [
    {
      type: 'MONTHLY_SUMMARY',
      title: `${monthName(prev.month)} ${prev.year} summary`,
      message: `Income ${fmt(income)} · Expenses ${fmt(expense)} · Net savings ${fmt(net)} (savings rate ${percentage(Math.max(net, 0), income)}%).`,
      dedupeKey,
    },
  ]);
}

export async function listNotifications(userId: string, opts: { unreadOnly: boolean; limit: number }) {
  await ensureMonthlySummary(userId);

  const where: Prisma.NotificationWhereInput = { userId, ...(opts.unreadOnly ? { isRead: false } : {}) };
  const [data, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts.limit,
      select: { id: true, type: true, title: true, message: true, isRead: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { data, unreadCount };
}

export async function markRead(userId: string, id: string) {
  const result = await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  if (result.count === 0) throw AppError.notFound('Notification');
  return prisma.notification.findUniqueOrThrow({ where: { id } });
}

export async function markAllRead(userId: string) {
  const result = await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  return { updated: result.count };
}

export async function deleteNotification(userId: string, id: string) {
  const result = await prisma.notification.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw AppError.notFound('Notification');
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

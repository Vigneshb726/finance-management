import type { FinancialGoal } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { calculateGoalProgress, percentage, round2 } from '../utils/calculations';
import { formatDateOnly, parseDateOnly } from '../utils/dates';
import type { goalSchema, updateGoalSchema } from '../validators/schemas';
import { checkGoalMilestones } from './notification.service';

const DAY_MS = 86_400_000;

export function serializeGoal(goal: FinancialGoal) {
  const target = goal.targetAmount.toNumber();
  const current = goal.currentAmount.toNumber();
  const { progress, remaining, isCompleted } = calculateGoalProgress(current, target);

  let daysLeft: number | null = null;
  let monthlyRequired: number | null = null;
  if (goal.targetDate) {
    const today = new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    daysLeft = Math.ceil((goal.targetDate.getTime() - todayUtc) / DAY_MS);
    if (daysLeft > 0 && remaining > 0) monthlyRequired = round2(remaining / Math.max(daysLeft / 30.44, 1));
  }

  const status = isCompleted ? 'COMPLETED' : daysLeft !== null && daysLeft < 0 ? 'OVERDUE' : 'IN_PROGRESS';

  return {
    id: goal.id,
    name: goal.name,
    description: goal.description,
    color: goal.color,
    targetAmount: target,
    currentAmount: current,
    targetDate: goal.targetDate ? formatDateOnly(goal.targetDate) : null,
    progress,
    remaining,
    daysLeft,
    monthlyRequired,
    status,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

async function findOwned(userId: string, id: string) {
  const goal = await prisma.financialGoal.findFirst({ where: { id, userId } });
  if (!goal) throw AppError.notFound('Goal');
  return goal;
}

const progressOf = (g: FinancialGoal) => percentage(g.currentAmount.toNumber(), g.targetAmount.toNumber());

export async function listGoals(userId: string) {
  const goals = await prisma.financialGoal.findMany({
    where: { userId },
    orderBy: [{ targetDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  });
  return goals.map(serializeGoal);
}

export async function getGoal(userId: string, id: string) {
  return serializeGoal(await findOwned(userId, id));
}

export async function createGoal(userId: string, input: z.infer<typeof goalSchema>) {
  const goal = await prisma.financialGoal.create({
    data: { ...input, targetDate: input.targetDate ? parseDateOnly(input.targetDate) : null, userId },
  });
  await checkGoalMilestones(userId, goal, 0, progressOf(goal));
  return serializeGoal(goal);
}

export async function updateGoal(userId: string, id: string, input: z.infer<typeof updateGoalSchema>) {
  const before = await findOwned(userId, id);
  const { targetDate, ...rest } = input;
  const goal = await prisma.financialGoal.update({
    where: { id },
    data: {
      ...rest,
      ...(targetDate !== undefined ? { targetDate: targetDate ? parseDateOnly(targetDate) : null } : {}),
    },
  });
  await checkGoalMilestones(userId, goal, progressOf(before), progressOf(goal));
  return serializeGoal(goal);
}

/** Adds (positive) or withdraws (negative) money from a goal. */
export async function contributeToGoal(userId: string, id: string, amount: number) {
  const before = await findOwned(userId, id);
  const next = round2(before.currentAmount.toNumber() + amount);
  if (next < 0) throw AppError.badRequest('Withdrawal exceeds the amount saved for this goal');

  const goal = await prisma.financialGoal.update({ where: { id }, data: { currentAmount: next } });
  await checkGoalMilestones(userId, goal, progressOf(before), progressOf(goal));
  return serializeGoal(goal);
}

export async function deleteGoal(userId: string, id: string) {
  const result = await prisma.financialGoal.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw AppError.notFound('Goal');
}

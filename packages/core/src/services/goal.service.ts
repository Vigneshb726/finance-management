import type { Selectable } from 'kysely';
import type { CoreContext } from '../context';
import type { FinancialGoalTable } from '../db/schema';
import { AppError } from '../errors';
import { calculateGoalProgress, percentage, round2 } from '../utils/calculations';
import { daysBetween, todayDateOnly } from '../utils/dates';
import { fromPaise, toPaise } from '../utils/money';
import type { GoalInput, UpdateGoalInput } from '../validators/schemas';
import { checkGoalMilestones } from './notification.service';

type GoalRow = Selectable<FinancialGoalTable>;

export function serializeGoal(goal: GoalRow, now = new Date()) {
  const target = fromPaise(goal.targetAmount);
  const current = fromPaise(goal.currentAmount);
  const { progress, remaining, isCompleted } = calculateGoalProgress(current, target);

  let daysLeft: number | null = null;
  let monthlyRequired: number | null = null;
  if (goal.targetDate) {
    daysLeft = daysBetween(todayDateOnly(now), goal.targetDate);
    if (daysLeft > 0 && remaining > 0) monthlyRequired = round2(remaining / Math.max(daysLeft / 30.44, 1));
  }

  const status: 'COMPLETED' | 'OVERDUE' | 'IN_PROGRESS' = isCompleted
    ? 'COMPLETED'
    : daysLeft !== null && daysLeft < 0
      ? 'OVERDUE'
      : 'IN_PROGRESS';

  return {
    id: goal.id,
    name: goal.name,
    description: goal.description,
    color: goal.color,
    targetAmount: target,
    currentAmount: current,
    targetDate: goal.targetDate,
    progress,
    remaining,
    daysLeft,
    monthlyRequired,
    status,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

async function findOwned(ctx: CoreContext, userId: string, id: string) {
  const goal = await ctx.db
    .selectFrom('FinancialGoal')
    .selectAll()
    .where('id', '=', id)
    .where('userId', '=', userId)
    .executeTakeFirst();
  if (!goal) throw AppError.notFound('Goal');
  return goal;
}

const progressOf = (g: GoalRow) => percentage(g.currentAmount, g.targetAmount);

export async function listGoals(ctx: CoreContext, userId: string) {
  const goals = await ctx.db
    .selectFrom('FinancialGoal')
    .selectAll()
    .where('userId', '=', userId)
    // Goals with a target date first (soonest first), then undated goals
    .orderBy((eb) => eb.case().when('targetDate', 'is', null).then(eb.lit(1)).else(eb.lit(0)).end())
    .orderBy('targetDate', 'asc')
    .orderBy('createdAt', 'desc')
    .execute();
  return goals.map((g) => serializeGoal(g, ctx.now()));
}

export async function getGoal(ctx: CoreContext, userId: string, id: string) {
  return serializeGoal(await findOwned(ctx, userId, id), ctx.now());
}

export async function createGoal(ctx: CoreContext, userId: string, input: GoalInput) {
  const id = ctx.newId();
  const now = ctx.now().toISOString();
  await ctx.db
    .insertInto('FinancialGoal')
    .values({
      id,
      userId,
      name: input.name,
      targetAmount: toPaise(input.targetAmount),
      currentAmount: toPaise(input.currentAmount),
      targetDate: input.targetDate,
      description: input.description,
      color: input.color,
      createdAt: now,
      updatedAt: now,
    })
    .execute();
  const goal = await findOwned(ctx, userId, id);
  await checkGoalMilestones(ctx, userId, goal, 0, progressOf(goal));
  return serializeGoal(goal, ctx.now());
}

export async function updateGoal(ctx: CoreContext, userId: string, id: string, input: UpdateGoalInput) {
  const before = await findOwned(ctx, userId, id);
  await ctx.db
    .updateTable('FinancialGoal')
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.targetAmount !== undefined ? { targetAmount: toPaise(input.targetAmount) } : {}),
      ...(input.currentAmount !== undefined ? { currentAmount: toPaise(input.currentAmount) } : {}),
      ...(input.targetDate !== undefined ? { targetDate: input.targetDate } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      updatedAt: ctx.now().toISOString(),
    })
    .where('id', '=', id)
    .where('userId', '=', userId)
    .execute();
  const goal = await findOwned(ctx, userId, id);
  await checkGoalMilestones(ctx, userId, goal, progressOf(before), progressOf(goal));
  return serializeGoal(goal, ctx.now());
}

/** Adds (positive) or withdraws (negative) money from a goal. */
export async function contributeToGoal(ctx: CoreContext, userId: string, id: string, amount: number) {
  const before = await findOwned(ctx, userId, id);
  const next = before.currentAmount + toPaise(amount);
  if (next < 0) throw AppError.badRequest('Withdrawal exceeds the amount saved for this goal');

  await ctx.db
    .updateTable('FinancialGoal')
    .set({ currentAmount: next, updatedAt: ctx.now().toISOString() })
    .where('id', '=', id)
    .where('userId', '=', userId)
    .execute();
  const goal = await findOwned(ctx, userId, id);
  await checkGoalMilestones(ctx, userId, goal, progressOf(before), progressOf(goal));
  return serializeGoal(goal, ctx.now());
}

export async function deleteGoal(ctx: CoreContext, userId: string, id: string) {
  const result = await ctx.db
    .deleteFrom('FinancialGoal')
    .where('id', '=', id)
    .where('userId', '=', userId)
    .executeTakeFirst();
  if (Number(result.numDeletedRows) === 0) throw AppError.notFound('Goal');
}

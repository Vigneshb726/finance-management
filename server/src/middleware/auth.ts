import type { Request } from 'express';
import { AppError, authService, recurringService } from '@finora/core';
import { core } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyToken } from '../utils/jwt';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

/** How often each user's due recurring transactions are generated (also on a new day). */
const DUE_TASK_INTERVAL_MS = 15 * 60 * 1000;
const lastDueRun = new Map<string, { at: number; day: string }>();

async function runDueTasks(userId: string) {
  const now = core.now();
  const day = now.toISOString().slice(0, 10);
  const last = lastDueRun.get(userId);
  if (last && last.day === day && now.getTime() - last.at < DUE_TASK_INTERVAL_MS) return;
  lastDueRun.set(userId, { at: now.getTime(), day });
  await recurringService.processDueRecurring(core, userId);
}

/** Requires a valid `Authorization: Bearer <jwt>` header for an existing user. */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw AppError.unauthorized();

  let userId: string;
  try {
    userId = verifyToken(header.slice(7).trim()).sub;
  } catch {
    throw AppError.unauthorized('Session expired or invalid. Please sign in again.');
  }

  if (!(await authService.userExists(core, userId))) throw AppError.unauthorized('Account no longer exists');

  req.userId = userId;
  await runDueTasks(userId);
  next();
});

export function getUserId(req: Request): string {
  if (!req.userId) throw AppError.unauthorized();
  return req.userId;
}

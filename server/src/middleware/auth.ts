import type { Request } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyToken } from '../utils/jwt';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
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

  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) throw AppError.unauthorized('Account no longer exists');

  req.userId = userId;
  next();
});

export function getUserId(req: Request): string {
  if (!req.userId) throw AppError.unauthorized();
  return req.userId;
}

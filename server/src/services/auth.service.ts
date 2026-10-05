import bcrypt from 'bcryptjs';
import type { Prisma, User } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../config/prisma';
import { DEFAULT_CATEGORIES } from '../config/defaultCategories';
import { AppError } from '../utils/AppError';
import { signToken } from '../utils/jwt';
import type { registerSchema, updateProfileSchema } from '../validators/schemas';

const SALT_ROUNDS = 12;
let dummyHash: string | undefined;

/** Strips the password hash — never send it to the client. */
export function toPublicUser(user: User) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function register(input: z.infer<typeof registerSchema>) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict('An account with this email already exists');

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
      categories: { create: DEFAULT_CATEGORIES.map((c) => ({ ...c, isDefault: true })) },
      notifications: {
        create: {
          type: 'SYSTEM',
          title: 'Welcome to Finora 👋',
          message: 'Start by adding a transaction, setting a monthly budget, or creating a savings goal.',
        },
      },
    },
  });

  return { user: toPublicUser(user), token: signToken(user.id) };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always run bcrypt to keep response time similar for unknown emails
  dummyHash ??= await bcrypt.hash('timing-equalisation-placeholder', SALT_ROUNDS);
  const valid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !valid) throw AppError.unauthorized('Invalid email or password');
  return { user: toPublicUser(user), token: signToken(user.id) };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User');
  return toPublicUser(user);
}

export async function updateProfile(userId: string, input: z.infer<typeof updateProfileSchema>) {
  if (input.email) {
    const taken = await prisma.user.findFirst({ where: { email: input.email, NOT: { id: userId } } });
    if (taken) throw AppError.conflict('This email is already in use');
  }
  const user = await prisma.user.update({ where: { id: userId }, data: input as Prisma.UserUpdateInput });
  return toPublicUser(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw AppError.badRequest('Current password is incorrect');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS) },
  });
}

export async function deleteAccount(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User');
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw AppError.badRequest('Password is incorrect');
  }
  await prisma.user.delete({ where: { id: userId } });
}

import type { Selectable } from 'kysely';
import { inTransaction, type CoreContext, type PasswordHasher } from '../context';
import { dbBool, type UserTable } from '../db/schema';
import { AppError } from '../errors';
import type { RegisterInput, UpdateProfileInput } from '../validators/schemas';
import { createDefaultCategories } from './category.service';
import { createNotifications } from './notification.service';

/** Strips the password hash — never send it to the client. */
export function toPublicUser(user: Selectable<UserTable>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = user;
  return {
    ...rest,
    notifyBudgetAlerts: !!rest.notifyBudgetAlerts,
    notifyGoalMilestones: !!rest.notifyGoalMilestones,
    notifyMonthlySummary: !!rest.notifyMonthlySummary,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;

// A real hash of a throwaway password, so unknown emails cost the same time as known ones
const dummyHashes = new WeakMap<PasswordHasher, Promise<string>>();
function dummyHash(hasher: PasswordHasher) {
  let hash = dummyHashes.get(hasher);
  if (!hash) {
    hash = hasher.hash('timing-equalisation-placeholder');
    dummyHashes.set(hasher, hash);
  }
  return hash;
}

const findByEmail = (ctx: CoreContext, email: string) =>
  ctx.db.selectFrom('User').selectAll().where('email', '=', email).executeTakeFirst();

async function findUser(ctx: CoreContext, userId: string) {
  const user = await ctx.db.selectFrom('User').selectAll().where('id', '=', userId).executeTakeFirst();
  if (!user) throw AppError.notFound('User');
  return user;
}

export async function register(ctx: CoreContext, input: RegisterInput) {
  if (await findByEmail(ctx, input.email)) throw AppError.conflict('An account with this email already exists');

  const passwordHash = await ctx.hasher.hash(input.password);
  const id = ctx.newId();
  const now = ctx.now().toISOString();

  await inTransaction(ctx, async (tx) => {
    await tx.db
      .insertInto('User')
      .values({
        id,
        name: input.name,
        email: input.email,
        passwordHash,
        currency: 'INR',
        theme: 'SYSTEM',
        notifyBudgetAlerts: dbBool(true),
        notifyGoalMilestones: dbBool(true),
        notifyMonthlySummary: dbBool(true),
        createdAt: now,
        updatedAt: now,
      })
      .execute();
    await createDefaultCategories(tx, id);
    await createNotifications(tx, id, [
      {
        type: 'SYSTEM',
        title: 'Welcome to Finora 👋',
        message: 'Start by adding a transaction, setting a monthly budget, or creating a savings goal.',
        dedupeKey: null,
      },
    ]);
  });

  return toPublicUser(await findUser(ctx, id));
}

/** Verifies credentials and returns the user. Token/session handling is up to the caller. */
export async function login(ctx: CoreContext, email: string, password: string) {
  const user = await findByEmail(ctx, email);
  const valid = await ctx.hasher.verify(password, user?.passwordHash ?? (await dummyHash(ctx.hasher)));
  if (!user || !valid) throw AppError.unauthorized('Invalid email or password');
  return toPublicUser(user);
}

export async function userExists(ctx: CoreContext, userId: string) {
  return !!(await ctx.db.selectFrom('User').select('id').where('id', '=', userId).executeTakeFirst());
}

export async function getMe(ctx: CoreContext, userId: string) {
  return toPublicUser(await findUser(ctx, userId));
}

export async function updateProfile(ctx: CoreContext, userId: string, input: UpdateProfileInput) {
  if (input.email) {
    const taken = await ctx.db
      .selectFrom('User')
      .select('id')
      .where('email', '=', input.email)
      .where('id', '!=', userId)
      .executeTakeFirst();
    if (taken) throw AppError.conflict('This email is already in use');
  }
  const { notifyBudgetAlerts, notifyGoalMilestones, notifyMonthlySummary, ...rest } = input;
  await ctx.db
    .updateTable('User')
    .set({
      ...rest,
      ...(notifyBudgetAlerts !== undefined ? { notifyBudgetAlerts: dbBool(notifyBudgetAlerts) } : {}),
      ...(notifyGoalMilestones !== undefined ? { notifyGoalMilestones: dbBool(notifyGoalMilestones) } : {}),
      ...(notifyMonthlySummary !== undefined ? { notifyMonthlySummary: dbBool(notifyMonthlySummary) } : {}),
      updatedAt: ctx.now().toISOString(),
    })
    .where('id', '=', userId)
    .execute();
  return getMe(ctx, userId);
}

export async function changePassword(ctx: CoreContext, userId: string, currentPassword: string, newPassword: string) {
  const user = await findUser(ctx, userId);
  if (!(await ctx.hasher.verify(currentPassword, user.passwordHash))) {
    throw AppError.badRequest('Current password is incorrect');
  }
  await ctx.db
    .updateTable('User')
    .set({ passwordHash: await ctx.hasher.hash(newPassword), updatedAt: ctx.now().toISOString() })
    .where('id', '=', userId)
    .execute();
}

export async function deleteAccount(ctx: CoreContext, userId: string, password: string) {
  const user = await findUser(ctx, userId);
  if (!(await ctx.hasher.verify(password, user.passwordHash))) {
    throw AppError.badRequest('Password is incorrect');
  }
  await ctx.db.deleteFrom('User').where('id', '=', userId).execute();
}

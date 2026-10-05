import type { TransactionType } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../config/prisma';
import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY_NAME } from '../config/defaultCategories';
import { AppError } from '../utils/AppError';
import type { createCategorySchema, updateCategorySchema } from '../validators/schemas';

export async function listCategories(userId: string, type?: TransactionType) {
  const categories = await prisma.category.findMany({
    where: { userId, ...(type ? { type } : {}) },
    orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { transactions: true } } },
  });
  return categories.map(({ _count, ...c }) => ({ ...c, transactionCount: _count.transactions }));
}

export async function createCategory(userId: string, input: z.infer<typeof createCategorySchema>) {
  await assertNameAvailable(userId, input.type, input.name);
  return prisma.category.create({ data: { ...input, userId, isDefault: false } });
}

export async function updateCategory(userId: string, id: string, input: z.infer<typeof updateCategorySchema>) {
  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) throw AppError.notFound('Category');

  if (input.name && input.name.toLowerCase() !== category.name.toLowerCase()) {
    if (category.isDefault) throw AppError.badRequest('Default categories cannot be renamed');
    await assertNameAvailable(userId, category.type, input.name, id);
  }
  return prisma.category.update({ where: { id }, data: input });
}

/** Deletes a custom category; its transactions move to the "Other" category of the same type. */
export async function deleteCategory(userId: string, id: string) {
  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) throw AppError.notFound('Category');
  if (category.isDefault) throw AppError.badRequest('Default categories cannot be deleted');

  return prisma.$transaction(async (tx) => {
    const defaults = DEFAULT_CATEGORIES.find((c) => c.name === FALLBACK_CATEGORY_NAME && c.type === category.type)!;
    const fallback = await tx.category.upsert({
      where: { userId_type_name: { userId, type: category.type, name: FALLBACK_CATEGORY_NAME } },
      update: {},
      create: { ...defaults, userId, isDefault: true },
    });
    const moved = await tx.transaction.updateMany({
      where: { userId, categoryId: id },
      data: { categoryId: fallback.id },
    });
    await tx.category.delete({ where: { id } });
    return { reassignedTransactions: moved.count, reassignedTo: fallback.name };
  });
}

async function assertNameAvailable(userId: string, type: TransactionType, name: string, excludeId?: string) {
  const clash = await prisma.category.findFirst({
    where: { userId, type, name: { equals: name, mode: 'insensitive' }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  if (clash) throw AppError.conflict(`A ${type.toLowerCase()} category named "${name}" already exists`);
}

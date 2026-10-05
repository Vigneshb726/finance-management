import type { Category, Prisma, Transaction, TransactionType } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { round2 } from '../utils/calculations';
import { formatDateOnly, parseDateOnly } from '../utils/dates';
import type { transactionQuerySchema, transactionSchema } from '../validators/schemas';
import { checkBudgetAlerts } from './notification.service';

type TransactionInput = z.infer<typeof transactionSchema>;
type TransactionQuery = z.infer<typeof transactionQuerySchema>;

const categorySelect = { id: true, name: true, color: true, icon: true, type: true } as const;

export function serializeTransaction(
  t: Transaction & { category: Pick<Category, 'id' | 'name' | 'color' | 'icon' | 'type'> },
) {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount.toNumber(),
    description: t.description,
    date: formatDateOnly(t.date),
    paymentMethod: t.paymentMethod,
    notes: t.notes,
    categoryId: t.categoryId,
    category: t.category,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

async function assertCategory(userId: string, categoryId: string, type: TransactionType) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw AppError.badRequest('Selected category does not exist');
  if (category.type !== type) {
    throw AppError.badRequest(`"${category.name}" is an ${category.type.toLowerCase()} category`);
  }
}

function buildWhere(userId: string, q: TransactionQuery): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };
  if (q.type) where.type = q.type;
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.paymentMethod) where.paymentMethod = q.paymentMethod;
  if (q.startDate || q.endDate) {
    where.date = {
      ...(q.startDate ? { gte: parseDateOnly(q.startDate) } : {}),
      ...(q.endDate ? { lte: parseDateOnly(q.endDate) } : {}),
    };
  }
  if (q.search) {
    where.OR = [
      { description: { contains: q.search, mode: 'insensitive' } },
      { notes: { contains: q.search, mode: 'insensitive' } },
      { category: { name: { contains: q.search, mode: 'insensitive' } } },
    ];
  }
  return where;
}

function buildOrderBy(q: TransactionQuery): Prisma.TransactionOrderByWithRelationInput[] {
  const dir = q.sortOrder;
  switch (q.sortBy) {
    case 'amount':
      return [{ amount: dir }, { date: 'desc' }];
    case 'description':
      return [{ description: dir }, { date: 'desc' }];
    case 'category':
      return [{ category: { name: dir } }, { date: 'desc' }];
    case 'createdAt':
      return [{ createdAt: dir }];
    default:
      return [{ date: dir }, { createdAt: dir }];
  }
}

export async function listTransactions(userId: string, q: TransactionQuery) {
  const where = buildWhere(userId, q);

  const [rows, total, sums] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: buildOrderBy(q),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { category: { select: categorySelect } },
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({ by: ['type'], where, _sum: { amount: true } }),
  ]);

  const income = sums.find((s) => s.type === 'INCOME')?._sum.amount?.toNumber() ?? 0;
  const expense = sums.find((s) => s.type === 'EXPENSE')?._sum.amount?.toNumber() ?? 0;

  return {
    data: rows.map(serializeTransaction),
    pagination: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    },
    totals: { income: round2(income), expense: round2(expense), net: round2(income - expense) },
  };
}

export async function getTransaction(userId: string, id: string) {
  const tx = await prisma.transaction.findFirst({
    where: { id, userId },
    include: { category: { select: categorySelect } },
  });
  if (!tx) throw AppError.notFound('Transaction');
  return serializeTransaction(tx);
}

export async function createTransaction(userId: string, input: TransactionInput) {
  await assertCategory(userId, input.categoryId, input.type);
  const tx = await prisma.transaction.create({
    data: { ...input, date: parseDateOnly(input.date), userId },
    include: { category: { select: categorySelect } },
  });
  if (tx.type === 'EXPENSE') await checkBudgetAlerts(userId, tx.date);
  return serializeTransaction(tx);
}

export async function updateTransaction(userId: string, id: string, input: TransactionInput) {
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) throw AppError.notFound('Transaction');

  await assertCategory(userId, input.categoryId, input.type);
  const tx = await prisma.transaction.update({
    where: { id },
    data: { ...input, date: parseDateOnly(input.date) },
    include: { category: { select: categorySelect } },
  });
  if (tx.type === 'EXPENSE') await checkBudgetAlerts(userId, tx.date);
  return serializeTransaction(tx);
}

export async function deleteTransaction(userId: string, id: string) {
  const result = await prisma.transaction.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw AppError.notFound('Transaction');
}

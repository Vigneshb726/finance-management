import { z } from 'zod';
import { PAYMENT_METHODS, RECURRENCE_FREQUENCIES, TRANSACTION_TYPES } from '../types';

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Invalid date');

/** Amounts arrive in rupees and are rounded to whole paise. */
export const money = z.coerce
  .number({ invalid_type_error: 'Amount must be a number' })
  .finite()
  .positive('Amount must be greater than 0')
  .max(999_999_999_999, 'Amount is too large')
  .transform((v) => Math.round(v * 100) / 100);

export const nonNegativeMoney = z.coerce
  .number({ invalid_type_error: 'Amount must be a number' })
  .finite()
  .min(0, 'Amount cannot be negative')
  .max(999_999_999_999, 'Amount is too large')
  .transform((v) => Math.round(v * 100) / 100);

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #4f46e5');

export const transactionType = z.enum(TRANSACTION_TYPES);

export const paymentMethod = z.enum(PAYMENT_METHODS);

export const recurrenceFrequency = z.enum(RECURRENCE_FREQUENCIES);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const yearSchema = z.coerce.number().int().min(2000).max(2100);
export const monthSchema = z.coerce.number().int().min(1).max(12);

export const idParam = z.object({ id: z.string().min(1) });

import type { CoreContext } from '../context';
import type { TransactionFilters } from '../validators/schemas';
import { findTransactions, type SerializedTransaction } from './transaction.service';

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CREDIT_CARD: 'Credit card',
  DEBIT_CARD: 'Debit card',
  BANK_TRANSFER: 'Bank transfer',
  OTHER: 'Other',
};

/** Byte-order mark so Excel opens the file as UTF-8 (₹ and other symbols display correctly). */
export const UTF8_BOM = String.fromCharCode(0xfeff);

/**
 * RFC 4180 cell. Text that a spreadsheet would treat as a formula (=, +, -, @, tab, CR)
 * is prefixed with an apostrophe to prevent CSV/formula injection.
 */
export function csvCell(value: string | number | null | undefined, { text = true } = {}): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (text && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function transactionsToCsv(rows: SerializedTransaction[]): string {
  const header = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Signed amount', 'Payment method', 'Notes', 'Recurring'];
  const lines = rows.map((t) =>
    [
      csvCell(t.date),
      csvCell(t.type === 'INCOME' ? 'Income' : 'Expense'),
      csvCell(t.category.name),
      csvCell(t.description),
      csvCell(t.amount.toFixed(2), { text: false }),
      csvCell((t.type === 'INCOME' ? t.amount : -t.amount).toFixed(2), { text: false }),
      csvCell(PAYMENT_LABELS[t.paymentMethod] ?? t.paymentMethod),
      csvCell(t.notes),
      csvCell(t.recurringId ? 'Yes' : 'No'),
    ].join(','),
  );
  return `${UTF8_BOM}${[header.join(','), ...lines].join('\r\n')}\r\n`;
}

/** CSV of every transaction matching the filters, plus a suggested file name. */
export async function exportTransactionsCsv(ctx: CoreContext, userId: string, filters: TransactionFilters) {
  const rows = await findTransactions(ctx, userId, filters);
  const stamp = ctx.now().toISOString().slice(0, 10);
  return { filename: `finora-transactions-${stamp}.csv`, content: transactionsToCsv(rows), count: rows.length };
}

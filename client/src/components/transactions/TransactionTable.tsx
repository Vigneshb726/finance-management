import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Repeat, StickyNote, Trash2 } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';
import type { Transaction, TransactionFilters } from '../../types';
import { cn } from '../../utils/cn';
import { paymentLabel } from '../../utils/constants';
import { formatDate } from '../../utils/format';
import { Badge, CategoryIcon } from '../ui/Display';

type SortKey = TransactionFilters['sortBy'];

interface Props {
  transactions: Transaction[];
  sortBy?: SortKey;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: SortKey) => void;
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
  compact?: boolean;
}

function SortHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
  align = 'left',
}: {
  label: string;
  column: SortKey;
  sortBy?: SortKey;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  if (!onSort) return <span>{label}</span>;
  const active = sortBy === column;
  const Icon = !active ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      onClick={() => onSort(column)}
      className={cn(
        'inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900 dark:hover:text-white',
        align === 'right' && 'flex-row-reverse',
        active && 'text-slate-900 dark:text-white',
      )}
      aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <Icon className={cn('h-3 w-3', !active && 'opacity-40')} />
    </button>
  );
}

export function TransactionTable({ transactions, sortBy, sortOrder, onSort, onEdit, onDelete, compact }: Props) {
  const { format } = useCurrency();
  const showActions = !!(onEdit || onDelete);
  const th = 'px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
            <tr>
              <th className={th}>
                <SortHeader label="Date" column="date" {...{ sortBy, sortOrder, onSort }} />
              </th>
              <th className={th}>
                <SortHeader label="Description" column="description" {...{ sortBy, sortOrder, onSort }} />
              </th>
              <th className={th}>
                <SortHeader label="Category" column="category" {...{ sortBy, sortOrder, onSort }} />
              </th>
              {!compact && <th className={th}>Type</th>}
              {!compact && <th className={th}>Payment</th>}
              <th className={cn(th, 'text-right')}>
                <SortHeader label="Amount" column="amount" align="right" {...{ sortBy, sortOrder, onSort }} />
              </th>
              {showActions && (
                <th className={cn(th, 'w-24 text-right')}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions.map((t) => (
              <tr key={t.id} className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500 dark:text-slate-400">{formatDate(t.date)}</td>
                <td className="max-w-[280px] px-5 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-slate-900 dark:text-white">{t.description}</span>
                    {t.recurringId && (
                      <span title="Added by a recurring transaction" className="text-brand-500">
                        <Repeat className="h-3.5 w-3.5" aria-label="Recurring" />
                      </span>
                    )}
                    {t.notes && (
                      <span title={t.notes} className="text-slate-400">
                        <StickyNote className="h-3.5 w-3.5" aria-label="Has notes" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <CategoryIcon icon={t.category.icon} color={t.category.color} size="sm" />
                    <span className="text-slate-700 dark:text-slate-300">{t.category.name}</span>
                  </div>
                </td>
                {!compact && (
                  <td className="px-5 py-3.5">
                    <Badge tone={t.type === 'INCOME' ? 'success' : 'danger'}>{t.type === 'INCOME' ? 'Income' : 'Expense'}</Badge>
                  </td>
                )}
                {!compact && <td className="whitespace-nowrap px-5 py-3.5 text-slate-600 dark:text-slate-400">{paymentLabel(t.paymentMethod)}</td>}
                <td
                  className={cn(
                    'tabular whitespace-nowrap px-5 py-3.5 text-right font-semibold',
                    t.type === 'INCOME' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white',
                  )}
                >
                  {t.type === 'INCOME' ? '+' : '−'}
                  {format(t.amount)}
                </td>
                {showActions && (
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(t)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                          aria-label={`Edit ${t.description}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(t)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          aria-label={`Delete ${t.description}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
        {transactions.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <CategoryIcon icon={t.category.icon} color={t.category.color} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-medium text-slate-900 dark:text-white">
                <span className="truncate">{t.description}</span>
                {t.recurringId && <Repeat className="h-3 w-3 shrink-0 text-brand-500" aria-label="Recurring" />}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {t.category.name} · {formatDate(t.date, { day: 'numeric', month: 'short' })} · {paymentLabel(t.paymentMethod)}
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  'tabular text-sm font-semibold',
                  t.type === 'INCOME' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white',
                )}
              >
                {t.type === 'INCOME' ? '+' : '−'}
                {format(t.amount)}
              </p>
              {showActions && (
                <div className="mt-1 flex justify-end gap-1">
                  {onEdit && (
                    <button onClick={() => onEdit(t)} className="p-1 text-slate-400" aria-label={`Edit ${t.description}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onDelete && (
                    <button onClick={() => onDelete(t)} className="p-1 text-slate-400" aria-label={`Delete ${t.description}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

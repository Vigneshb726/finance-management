import { PieChart as PieIcon } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';
import type { CategoryBreakdown } from '../../types';
import { CategoryIcon } from '../ui/Display';
import { EmptyState } from '../ui/Feedback';

/**
 * Ranked horizontal bars — reads magnitude more accurately than a pie,
 * and every row carries a visible label + value (identity is never colour-alone).
 */
export function CategoryBreakdownList({ data, limit }: { data: CategoryBreakdown; limit?: number }) {
  const { format } = useCurrency();
  const rows = limit ? data.data.slice(0, limit) : data.data;
  const max = Math.max(...rows.map((r) => r.total), 1);

  if (!rows.length) {
    return (
      <EmptyState
        icon={<PieIcon className="h-6 w-6" />}
        title={`No ${data.type === 'EXPENSE' ? 'spending' : 'income'} yet`}
        description="Category breakdown appears once transactions are recorded for this period."
        className="py-8"
      />
    );
  }

  return (
    <ul className="space-y-3.5">
      {rows.map((row) => (
        <li key={row.categoryId} className="group flex items-center gap-3" title={`${row.count} transaction(s)`}>
          <CategoryIcon icon={row.icon} color={row.color} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium text-slate-700 dark:text-slate-200">{row.name}</span>
              <span className="tabular shrink-0 text-slate-900 dark:text-white">
                {format(row.total)}
                <span className="ml-1.5 text-xs text-slate-500 dark:text-slate-400">{row.percentage.toFixed(1)}%</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${(row.total / max) * 100}%`, backgroundColor: row.color }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

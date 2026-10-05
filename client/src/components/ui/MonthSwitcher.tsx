import { ChevronLeft, ChevronRight } from 'lucide-react';
import { currentPeriod, monthLabel, shiftPeriod } from '../../utils/format';

interface Period {
  year: number;
  month: number;
}

export function MonthSwitcher({ value, onChange, allowFuture = false }: { value: Period; onChange: (p: Period) => void; allowFuture?: boolean }) {
  const now = currentPeriod();
  const isCurrentOrLater = value.year * 12 + value.month >= now.year * 12 + now.month;
  return (
    <div className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
      <button
        className="flex h-full w-9 items-center justify-center rounded-l-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
        onClick={() => onChange(shiftPeriod(value, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[128px] px-2 text-center text-sm font-medium text-slate-700 dark:text-slate-200">
        {monthLabel(value.year, value.month)}
      </span>
      <button
        className="flex h-full w-9 items-center justify-center rounded-r-lg text-slate-500 hover:bg-slate-50 disabled:opacity-30 dark:hover:bg-slate-800"
        onClick={() => onChange(shiftPeriod(value, 1))}
        disabled={!allowFuture && isCurrentOrLater}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

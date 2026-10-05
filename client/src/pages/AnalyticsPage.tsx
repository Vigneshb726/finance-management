import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, Percent, PiggyBank } from 'lucide-react';
import { BudgetPerformanceChart } from '../components/charts/BudgetPerformanceChart';
import { CategoryBreakdownList } from '../components/charts/CategoryBreakdownList';
import { IncomeExpenseChart } from '../components/charts/IncomeExpenseChart';
import { SavingsChart } from '../components/charts/SavingsChart';
import { TrendChart } from '../components/charts/TrendChart';
import { Card, CardHeader, PageHeader, StatCard } from '../components/ui/Display';
import { ErrorState, Skeleton } from '../components/ui/Feedback';
import { useCategoryBreakdown, useMonthly } from '../hooks/queries';
import { useCurrency } from '../hooks/useCurrency';
import { cn } from '../utils/cn';
import { currentPeriod, monthBounds, shiftPeriod, shortMonth } from '../utils/format';

const RANGES = [3, 6, 12] as const;

export default function AnalyticsPage() {
  const { format } = useCurrency();
  const [months, setMonths] = useState<(typeof RANGES)[number]>(6);
  const [showTable, setShowTable] = useState(false);

  const now = currentPeriod();
  const startPeriod = shiftPeriod(now, -(months - 1));
  const range = { startDate: monthBounds(startPeriod).startDate, endDate: monthBounds(now).endDate };

  const monthly = useMonthly({ ...now, months });
  const expenses = useCategoryBreakdown({ type: 'EXPENSE', ...range });
  const income = useCategoryBreakdown({ type: 'INCOME', ...range });

  const totals = useMemo(() => {
    const data = monthly.data ?? [];
    const inc = data.reduce((s, d) => s + d.income, 0);
    const exp = data.reduce((s, d) => s + d.expense, 0);
    return { income: inc, expense: exp, net: inc - exp, rate: inc > 0 ? (Math.max(inc - exp, 0) / inc) * 100 : 0, avgExpense: data.length ? exp / data.length : 0 };
  }, [monthly.data]);

  const loading = monthly.isLoading;
  const chart = (node: ReactNode, h = 300) =>
    loading ? <Skeleton style={{ height: h }} className="w-full" /> : monthly.isError ? <ErrorState error={monthly.error} onRetry={() => monthly.refetch()} /> : node;

  return (
    <>
      <PageHeader
        title="Reports & analytics"
        description="Understand your income, spending and savings over time."
        actions={
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setMonths(r)}
                aria-pressed={months === r}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition',
                  months === r ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                {r} months
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total income" value={format(totals.income)} loading={loading} icon={<ArrowDownLeft className="h-5 w-5" />} iconClass="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400" footer={<span className="text-xs text-slate-500">Last {months} months</span>} />
        <StatCard label="Total expenses" value={format(totals.expense)} loading={loading} icon={<ArrowUpRight className="h-5 w-5" />} iconClass="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" footer={<span className="text-xs text-slate-500">Avg {format(totals.avgExpense)}/month</span>} />
        <StatCard label="Net savings" value={format(totals.net)} loading={loading} icon={<PiggyBank className="h-5 w-5" />} iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" footer={<span className="text-xs text-slate-500">Income − expenses</span>} />
        <StatCard label="Savings rate" value={`${totals.rate.toFixed(1)}%`} loading={loading} icon={<Percent className="h-5 w-5" />} iconClass="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400" footer={<span className="text-xs text-slate-500">Share of income saved</span>} />
      </div>

      <Card className="mt-4">
        <CardHeader title="Spending trends" subtitle="Income, expenses and net savings by month" />
        <div className="p-5">{chart(<TrendChart data={monthly.data ?? []} />)}</div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Income vs expenses" subtitle="Monthly comparison" />
          <div className="p-5">{chart(<IncomeExpenseChart data={monthly.data ?? []} />, 280)}</div>
        </Card>
        <Card>
          <CardHeader title="Savings trend" subtitle="Net savings each month" />
          <div className="p-5">{chart(<SavingsChart data={monthly.data ?? []} />, 280)}</div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Category-wise spending" subtitle={`Last ${months} months · ${format(expenses.data?.total ?? 0)}`} />
          <div className="p-5">{expenses.data ? <CategoryBreakdownList data={expenses.data} /> : <Skeleton className="h-64" />}</div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Budget performance" subtitle="Monthly spending against budget" />
            <div className="p-5">{chart(<BudgetPerformanceChart data={monthly.data ?? []} height={240} />, 260)}</div>
          </Card>
          <Card>
            <CardHeader title="Income sources" subtitle={`Last ${months} months · ${format(income.data?.total ?? 0)}`} />
            <div className="p-5">{income.data ? <CategoryBreakdownList data={income.data} /> : <Skeleton className="h-40" />}</div>
          </Card>
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader
          title="Monthly breakdown"
          subtitle="The numbers behind the charts"
          action={
            <button onClick={() => setShowTable((s) => !s)} className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400" aria-expanded={showTable}>
              {showTable ? 'Hide table' : 'Show table'}
            </button>
          }
        />
        {showTable && monthly.data && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  {['Month', 'Income', 'Expenses', 'Net savings', 'Savings rate', 'Budget', 'Budget used'].map((h, i) => (
                    <th key={h} className={cn('px-5 py-3 font-semibold', i === 0 ? 'text-left' : 'text-right')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-slate-100 dark:divide-slate-800">
                {[...monthly.data].reverse().map((m) => (
                  <tr key={m.month}>
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{shortMonth(m.month, true)}</td>
                    <td className="px-5 py-3 text-right">{format(m.income)}</td>
                    <td className="px-5 py-3 text-right">{format(m.expense)}</td>
                    <td className={cn('px-5 py-3 text-right font-medium', m.savings < 0 && 'text-red-600 dark:text-red-400')}>{format(m.savings)}</td>
                    <td className="px-5 py-3 text-right">{m.savingsRate}%</td>
                    <td className="px-5 py-3 text-right">{m.budget != null ? format(m.budget) : '—'}</td>
                    <td className="px-5 py-3 text-right">{m.budgetUsage != null ? `${m.budgetUsage}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!showTable && <div className="pb-5" />}
      </Card>
    </>
  );
}

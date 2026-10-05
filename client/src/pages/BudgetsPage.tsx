import { useState } from 'react';
import { AlertTriangle, Pencil, PiggyBank, Plus, Trash2, XCircle } from 'lucide-react';
import { BudgetForm } from '../components/budgets/BudgetForm';
import { DailySpendingChart } from '../components/charts/DailySpendingChart';
import { Button } from '../components/ui/Button';
import { BudgetStatusBadge, Card, CardHeader, CategoryIcon, PageHeader, ProgressBar } from '../components/ui/Display';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/Modal';
import { MonthSwitcher } from '../components/ui/MonthSwitcher';
import { useBudgets, useDaily, useDeleteBudget } from '../hooks/queries';
import { useCurrency } from '../hooks/useCurrency';
import type { Budget } from '../types';
import { cn } from '../utils/cn';
import { currentPeriod, monthLabel } from '../utils/format';

export default function BudgetsPage() {
  const { format } = useCurrency();
  const [period, setPeriod] = useState(currentPeriod);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);

  const all = useBudgets();
  const daily = useDaily(period);
  const remove = useDeleteBudget();
  const budget = all.data?.find((b) => b.year === period.year && b.month === period.month) ?? null;
  const history = (all.data ?? []).filter((b) => b !== budget).slice(0, 6);

  const alerts = budget
    ? [
        ...(budget.status !== 'ON_TRACK' ? [{ name: 'Overall budget', status: budget.status, usage: budget.usage }] : []),
        ...budget.categories.filter((c) => c.status !== 'ON_TRACK').map((c) => ({ name: c.category.name, status: c.status, usage: c.usage })),
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Plan your monthly spending and stay within your limits."
        actions={
          <>
            <MonthSwitcher value={period} onChange={setPeriod} allowFuture />
            {!budget && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Create budget
              </Button>
            )}
          </>
        }
      />

      {all.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      ) : all.isError ? (
        <ErrorState error={all.error} onRetry={() => all.refetch()} />
      ) : !budget ? (
        <Card>
          <EmptyState
            icon={<PiggyBank className="h-6 w-6" />}
            title={`No budget for ${monthLabel(period.year, period.month)}`}
            description="Create a monthly budget with optional category limits. You'll get alerts at 80% and when a budget is exceeded."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Create budget
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {alerts.length > 0 && (
            <div className="mb-4 space-y-2" role="status">
              {alerts.map((a) => (
                <div
                  key={a.name}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm',
                    a.status === 'EXCEEDED'
                      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
                      : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
                  )}
                >
                  {a.status === 'EXCEEDED' ? <XCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                  <span>
                    <strong>{a.name}</strong>{' '}
                    {a.status === 'EXCEEDED' ? `has been exceeded (${a.usage}% used).` : `is almost used up (${a.usage}% used).`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{monthLabel(budget.year, budget.month)}</p>
                  <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{format(budget.totalAmount)}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditing(budget);
                      setFormOpen(true);
                    }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                    aria-label="Edit budget"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(budget)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    aria-label="Delete budget"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <ProgressBar value={budget.usage} status={budget.status} className="h-2.5" label="Budget used" />
                <span className="tabular text-sm font-medium text-slate-700 dark:text-slate-300">{budget.usage}%</span>
              </div>
              <dl className="mt-5 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">Spent</dt>
                  <dd className="tabular font-medium text-slate-900 dark:text-white">{format(budget.spent)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">Remaining</dt>
                  <dd className={cn('tabular font-medium', budget.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white')}>
                    {format(budget.remaining)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">Allocated to categories</dt>
                  <dd className="tabular font-medium text-slate-900 dark:text-white">{format(budget.allocated)}</dd>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <dt className="text-slate-500 dark:text-slate-400">Status</dt>
                  <dd>
                    <BudgetStatusBadge status={budget.status} />
                  </dd>
                </div>
              </dl>
              {budget.notes && <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">{budget.notes}</p>}
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title="Spending pace" subtitle="Cumulative spending this month vs. your budget" />
              <div className="p-5">
                {daily.isLoading ? <Skeleton className="h-[260px]" /> : <DailySpendingChart data={daily.data ?? []} budget={budget.totalAmount} />}
              </div>
            </Card>
          </div>

          <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-900 dark:text-white">Category budgets</h2>
          {budget.categories.length === 0 ? (
            <Card>
              <EmptyState
                icon={<PiggyBank className="h-6 w-6" />}
                title="No category limits"
                description="Add category-wise limits to see exactly where you're overspending."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(budget);
                      setFormOpen(true);
                    }}
                  >
                    Add category limits
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {budget.categories.map((c) => (
                <Card key={c.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CategoryIcon icon={c.category.icon} color={c.category.color} />
                      <p className="font-medium text-slate-900 dark:text-white">{c.category.name}</p>
                    </div>
                    <BudgetStatusBadge status={c.status} />
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <ProgressBar value={c.usage} status={c.status} label={`${c.category.name} budget used`} />
                    <span className="tabular w-14 text-right text-sm font-medium text-slate-700 dark:text-slate-300">{c.usage}%</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Budget</dt>
                      <dd className="tabular mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{format(c.amount)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Spent</dt>
                      <dd className="tabular mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{format(c.spent)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Remaining</dt>
                      <dd className={cn('tabular mt-0.5 text-sm font-medium', c.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white')}>
                        {format(c.remaining)}
                      </dd>
                    </div>
                  </dl>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {history.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-900 dark:text-white">Other budgets</h2>
          <Card className="divide-y divide-slate-100 dark:divide-slate-800">
            {history.map((b) => (
              <button
                key={b.id}
                onClick={() => setPeriod({ year: b.year, month: b.month })}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <span className="w-32 text-sm font-medium text-slate-900 dark:text-white">{monthLabel(b.year, b.month)}</span>
                <ProgressBar value={b.usage} status={b.status} className="flex-1" label={`${monthLabel(b.year, b.month)} budget used`} />
                <span className="tabular hidden w-44 text-right text-sm text-slate-500 dark:text-slate-400 sm:block">
                  {format(b.spent, { compact: true })} / {format(b.totalAmount, { compact: true })}
                </span>
                <BudgetStatusBadge status={b.status} />
              </button>
            ))}
          </Card>
        </>
      )}

      <BudgetForm open={formOpen} onClose={() => setFormOpen(false)} budget={editing} period={period} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete budget?"
        message={deleting && `The budget for ${monthLabel(deleting.year, deleting.month)} and its category limits will be removed. Transactions are not affected.`}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </>
  );
}

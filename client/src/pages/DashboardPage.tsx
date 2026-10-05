import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, PiggyBank, Plus, Receipt, Target, Wallet } from 'lucide-react';
import { CategoryBreakdownList } from '../components/charts/CategoryBreakdownList';
import { IncomeExpenseChart } from '../components/charts/IncomeExpenseChart';
import { TransactionForm } from '../components/transactions/TransactionForm';
import { TransactionTable } from '../components/transactions/TransactionTable';
import { Button } from '../components/ui/Button';
import { BudgetStatusBadge, Card, CardHeader, Delta, PageHeader, ProgressBar, StatCard } from '../components/ui/Display';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import { MonthSwitcher } from '../components/ui/MonthSwitcher';
import { useCategoryBreakdown, useGoals, useMonthly, useSummary } from '../hooks/queries';
import { useCurrency } from '../hooks/useCurrency';
import { currentPeriod, monthBounds, monthLabel } from '../utils/format';

export default function DashboardPage() {
  const [period, setPeriod] = useState(currentPeriod);
  const [addOpen, setAddOpen] = useState(false);
  const { format } = useCurrency();

  const summary = useSummary(period);
  const monthly = useMonthly({ ...period, months: 6 });
  const breakdown = useCategoryBreakdown({ type: 'EXPENSE', ...monthBounds(period) });
  const goals = useGoals();

  const s = summary.data;
  const loading = summary.isLoading;

  if (summary.isError) return <ErrorState error={summary.error} onRetry={() => summary.refetch()} />;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Your financial overview for ${monthLabel(period.year, period.month)}`}
        actions={<MonthSwitcher value={period} onChange={setPeriod} />}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total balance"
          value={format(s?.totalBalance ?? 0)}
          loading={loading}
          icon={<Wallet className="h-5 w-5" />}
          iconClass="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
          footer={
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {format(s?.totalIncome ?? 0, { compact: true })} in · {format(s?.totalExpenses ?? 0, { compact: true })} out (all time)
            </span>
          }
        />
        <StatCard
          label="Income"
          value={format(s?.month.income ?? 0)}
          loading={loading}
          icon={<ArrowDownLeft className="h-5 w-5" />}
          iconClass="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
          footer={s && <Delta value={s.month.incomeChange} />}
        />
        <StatCard
          label="Expenses"
          value={format(s?.month.expenses ?? 0)}
          loading={loading}
          icon={<ArrowUpRight className="h-5 w-5" />}
          iconClass="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
          footer={s && <Delta value={s.month.expenseChange} invert />}
        />
        <StatCard
          label="Net savings"
          value={format(s?.month.netSavings ?? 0)}
          loading={loading}
          icon={<PiggyBank className="h-5 w-5" />}
          iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
          footer={s && <span className="text-xs text-slate-500 dark:text-slate-400">Savings rate {s.month.savingsRate}%</span>}
        />
      </div>

      {/* Budget + Goals */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Monthly budget"
            subtitle={monthLabel(period.year, period.month)}
            action={
              <Link to="/budgets" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                Manage <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="p-5">
            {loading ? (
              <Skeleton className="h-24" />
            ) : s?.budget ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Budget</p>
                    <p className="tabular mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">{format(s.budget.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Spent</p>
                    <p className="tabular mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">{format(s.budget.spent)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Remaining</p>
                    <p className={`tabular mt-0.5 text-lg font-semibold ${s.budget.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                      {format(s.budget.remaining)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <ProgressBar value={s.budget.usage} status={s.budget.status} className="h-2.5" label="Budget used" />
                  <span className="tabular w-14 text-right text-sm font-medium text-slate-700 dark:text-slate-300">{s.budget.usage}%</span>
                </div>
                <div className="mt-3">
                  <BudgetStatusBadge status={s.budget.status} />
                </div>
                {s.budget.categories.length > 0 && (
                  <div className="mt-5 grid gap-x-6 gap-y-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-2">
                    {s.budget.categories.slice(0, 6).map((c) => (
                      <div key={c.id}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{c.category.name}</span>
                          <span className="tabular text-slate-500 dark:text-slate-400">
                            {format(c.spent, { compact: true })} / {format(c.amount, { compact: true })}
                          </span>
                        </div>
                        <ProgressBar value={c.usage} status={c.status} className="h-1.5" label={`${c.category.name} budget used`} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                className="py-6"
                icon={<PiggyBank className="h-6 w-6" />}
                title="No budget for this month"
                description="Set a monthly budget to track how much you can still spend."
                action={
                  <Link to="/budgets">
                    <Button size="sm">Create budget</Button>
                  </Link>
                }
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Savings goals"
            subtitle={s ? `${s.goals.completed} of ${s.goals.count} completed` : undefined}
            action={
              <Link to="/goals" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="p-5">
            {goals.isLoading ? (
              <Skeleton className="h-32" />
            ) : !goals.data?.length ? (
              <EmptyState className="py-6" icon={<Target className="h-6 w-6" />} title="No goals yet" description="Create a savings goal to track your progress." />
            ) : (
              <>
                <div className="mb-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total saved</p>
                  <p className="tabular text-lg font-semibold text-slate-900 dark:text-white">
                    {format(s?.goals.totalSaved ?? 0)}
                    <span className="ml-1 text-sm font-normal text-slate-500">of {format(s?.goals.totalTarget ?? 0)}</span>
                  </p>
                  <ProgressBar value={s?.goals.progress ?? 0} className="mt-2" label="Overall goal progress" />
                </div>
                <ul className="space-y-3.5">
                  {goals.data.slice(0, 3).map((g) => (
                    <li key={g.id}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="truncate font-medium text-slate-700 dark:text-slate-200">{g.name}</span>
                        <span className="tabular text-slate-500 dark:text-slate-400">{g.progress.toFixed(1)}%</span>
                      </div>
                      <ProgressBar value={g.progress} color={g.color} className="h-1.5" label={`${g.name} progress`} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Income vs expenses" subtitle="Last 6 months" />
          <div className="p-5">
            {monthly.isLoading ? <Skeleton className="h-[300px]" /> : monthly.isError ? <ErrorState error={monthly.error} onRetry={() => monthly.refetch()} /> : <IncomeExpenseChart data={monthly.data ?? []} />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Spending by category" subtitle={monthLabel(period.year, period.month)} />
          <div className="p-5">
            {breakdown.isLoading || !breakdown.data ? <Skeleton className="h-[300px]" /> : <CategoryBreakdownList data={breakdown.data} limit={6} />}
          </div>
        </Card>
      </div>

      {/* Monthly summary + recent transactions */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Monthly summary" subtitle={monthLabel(period.year, period.month)} />
          <dl className="space-y-3 p-5 text-sm">
            {[
              ['Income', format(s?.month.income ?? 0)],
              ['Expenses', format(s?.month.expenses ?? 0)],
              ['Net savings', format(s?.month.netSavings ?? 0)],
              ['Savings rate', `${s?.month.savingsRate ?? 0}%`],
              ['Transactions', String(s?.month.transactionCount ?? 0)],
              ['Budget used', s?.budget ? `${s.budget.usage}%` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-dashed border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                <dd className="tabular font-medium text-slate-900 dark:text-white">{loading ? '…' : v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader
            title="Recent transactions"
            action={
              <Link to="/transactions" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-3">
            {loading ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : s?.recentTransactions.length ? (
              <TransactionTable transactions={s.recentTransactions} compact />
            ) : (
              <EmptyState
                icon={<Receipt className="h-6 w-6" />}
                title="No transactions yet"
                description="Add your first income or expense to see your dashboard come alive."
                action={
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="h-4 w-4" /> Add transaction
                  </Button>
                }
              />
            )}
          </div>
        </Card>
      </div>

      <TransactionForm open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

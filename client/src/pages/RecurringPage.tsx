import { useState } from 'react';
import { CalendarClock, CheckCircle2, Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import { RecurringForm } from '../components/recurring/RecurringForm';
import { Button } from '../components/ui/Button';
import { Badge, Card, CategoryIcon, PageHeader, StatCard } from '../components/ui/Display';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/Modal';
import { useDeleteRecurring, useRecurring, useToggleRecurring } from '../hooks/queries';
import { useCurrency } from '../hooks/useCurrency';
import type { RecurringInput, RecurringTransaction } from '../types';
import { cn } from '../utils/cn';
import { formatDate } from '../utils/format';
import { describeSchedule } from '../utils/recurrence';

function StatusBadge({ rule }: { rule: RecurringTransaction }) {
  if (rule.status === 'COMPLETED')
    return (
      <Badge tone="neutral">
        <CheckCircle2 className="h-3 w-3" /> Finished
      </Badge>
    );
  if (rule.status === 'PAUSED')
    return (
      <Badge tone="warning">
        <Pause className="h-3 w-3" /> Paused
      </Badge>
    );
  return (
    <Badge tone="success">
      <Repeat className="h-3 w-3" /> Active
    </Badge>
  );
}

const toInput = (rule: RecurringTransaction, isActive: boolean): RecurringInput => ({
  type: rule.type,
  amount: rule.amount,
  categoryId: rule.categoryId,
  description: rule.description,
  paymentMethod: rule.paymentMethod,
  notes: rule.notes,
  frequency: rule.frequency,
  interval: rule.interval,
  startDate: rule.startDate,
  endDate: rule.endDate,
  isActive,
});

/** Approximate monthly value of a rule, for the summary cards. */
function monthlyEquivalent(rule: RecurringTransaction) {
  const perMonth = { DAILY: 30.44, WEEKLY: 4.35, MONTHLY: 1, YEARLY: 1 / 12 }[rule.frequency];
  return (rule.amount * perMonth) / rule.interval;
}

export default function RecurringPage() {
  const { format } = useCurrency();
  const { data: rules, isLoading, isError, error, refetch } = useRecurring();
  const toggle = useToggleRecurring();
  const remove = useDeleteRecurring();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [deleting, setDeleting] = useState<RecurringTransaction | null>(null);

  const active = rules?.filter((r) => r.status === 'ACTIVE') ?? [];
  const monthlyIncome = active.filter((r) => r.type === 'INCOME').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const monthlyExpense = active.filter((r) => r.type === 'EXPENSE').reduce((s, r) => s + monthlyEquivalent(r), 0);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Recurring transactions"
        description="Repeating income and bills are added automatically — even when the app was closed on the due date."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New recurring
          </Button>
        }
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Active rules"
              value={String(active.length)}
              loading={isLoading}
              icon={<Repeat className="h-5 w-5" />}
              iconClass="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
            />
            <StatCard
              label="Recurring income / month"
              value={format(monthlyIncome)}
              loading={isLoading}
              icon={<CalendarClock className="h-5 w-5" />}
              iconClass="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
              footer={<span className="text-xs text-slate-500">Approximate, from active rules</span>}
            />
            <StatCard
              label="Recurring expenses / month"
              value={format(monthlyExpense)}
              loading={isLoading}
              icon={<CalendarClock className="h-5 w-5" />}
              iconClass="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
              footer={<span className="text-xs text-slate-500">Approximate, from active rules</span>}
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : !rules?.length ? (
            <Card>
              <EmptyState
                icon={<Repeat className="h-6 w-6" />}
                title="No recurring transactions"
                description="Add your salary, rent, EMIs or subscriptions once and Finora records them on schedule."
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" /> Add a recurring transaction
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card className="divide-y divide-slate-100 dark:divide-slate-800">
              {rules.map((rule) => (
                <div key={rule.id} className={cn('flex flex-col gap-3 p-4 sm:flex-row sm:items-center', rule.status !== 'ACTIVE' && 'opacity-75')}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <CategoryIcon icon={rule.category.icon} color={rule.category.color} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{rule.description}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {rule.category.name} · {describeSchedule(rule.frequency, rule.interval)} · since {formatDate(rule.startDate)}
                        {rule.endDate ? ` · until ${formatDate(rule.endDate)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p
                        className={cn(
                          'tabular text-sm font-semibold',
                          rule.type === 'INCOME' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white',
                        )}
                      >
                        {rule.type === 'INCOME' ? '+' : '−'}
                        {format(rule.amount)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {rule.nextDate ? `Next: ${formatDate(rule.nextDate)}` : `${rule.occurrenceCount} added`}
                      </p>
                    </div>
                    <StatusBadge rule={rule} />
                    <div className="flex items-center gap-1">
                      {rule.status !== 'COMPLETED' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={rule.isActive ? `Pause ${rule.description}` : `Resume ${rule.description}`}
                          title={rule.isActive ? 'Pause' : 'Resume'}
                          loading={toggle.isPending && toggle.variables?.id === rule.id}
                          onClick={() => toggle.mutate({ id: rule.id, data: toInput(rule, !rule.isActive) })}
                        >
                          {!(toggle.isPending && toggle.variables?.id === rule.id) &&
                            (rule.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />)}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${rule.description}`}
                        title="Edit"
                        onClick={() => {
                          setEditing(rule);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${rule.description}`} title="Delete" onClick={() => setDeleting(rule)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      <RecurringForm open={formOpen} onClose={() => setFormOpen(false)} rule={editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete recurring transaction?"
        message={
          deleting &&
          `"${deleting.description}" will stop repeating. The ${deleting.occurrenceCount} transaction(s) it already added stay in your history.`
        }
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </>
  );
}

import { useState } from 'react';
import { CalendarClock, CheckCircle2, Clock, MoreVertical, Pencil, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import { ContributeForm, GoalForm } from '../components/goals/GoalForm';
import { Button } from '../components/ui/Button';
import { Badge, Card, PageHeader, ProgressBar, StatCard } from '../components/ui/Display';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/Modal';
import { useDeleteGoal, useGoals } from '../hooks/queries';
import { useCurrency } from '../hooks/useCurrency';
import type { Goal } from '../types';
import { formatDate } from '../utils/format';

function GoalStatus({ goal }: { goal: Goal }) {
  if (goal.status === 'COMPLETED')
    return (
      <Badge tone="success">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </Badge>
    );
  if (goal.status === 'OVERDUE')
    return (
      <Badge tone="danger">
        <Clock className="h-3 w-3" /> Overdue
      </Badge>
    );
  return (
    <Badge tone="brand">
      <TrendingUp className="h-3 w-3" /> In progress
    </Badge>
  );
}

function GoalCard({ goal, onEdit, onDelete, onContribute }: { goal: Goal; onEdit: () => void; onDelete: () => void; onContribute: () => void }) {
  const { format } = useCurrency();
  const [menu, setMenu] = useState(false);

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${goal.color}1f`, color: goal.color }}>
            <Target className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-900 dark:text-white">{goal.name}</h3>
            <GoalStatus goal={goal} />
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            onBlur={() => setTimeout(() => setMenu(false), 150)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={`Actions for ${goal.name}`}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menu && (
            <div className="absolute right-0 top-8 z-10 w-36 animate-scale-in rounded-lg border border-slate-200 bg-white p-1 shadow-pop dark:border-slate-700 dark:bg-slate-900">
              <button onMouseDown={onEdit} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button onMouseDown={onDelete} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {goal.description && <p className="mt-3 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{goal.description}</p>}

      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="tabular text-xl font-semibold text-slate-900 dark:text-white">{format(goal.currentAmount)}</p>
          <p className="tabular text-sm font-medium text-slate-700 dark:text-slate-300">{goal.progress.toFixed(2).replace(/\.?0+$/, '')}%</p>
        </div>
        <ProgressBar value={goal.progress} color={goal.color} className="h-2.5" label={`${goal.name} progress`} />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">of {format(goal.targetAmount)} target</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Remaining</dt>
          <dd className="tabular mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{format(goal.remaining)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Target date</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{goal.targetDate ? formatDate(goal.targetDate) : '—'}</dd>
        </div>
      </dl>
      {goal.monthlyRequired && goal.status === 'IN_PROGRESS' && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          Save about <span className="tabular font-medium text-slate-900 dark:text-white">{format(goal.monthlyRequired)}</span>/month · {goal.daysLeft} days left
        </p>
      )}

      <div className="mt-auto pt-4">
        <Button variant="outline" className="w-full" onClick={onContribute}>
          <Plus className="h-4 w-4" /> Add money
        </Button>
      </div>
    </Card>
  );
}

export default function GoalsPage() {
  const { format } = useCurrency();
  const { data: goals, isLoading, isError, error, refetch } = useGoals();
  const remove = useDeleteGoal();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);

  const totalTarget = goals?.reduce((s, g) => s + g.targetAmount, 0) ?? 0;
  const totalSaved = goals?.reduce((s, g) => s + g.currentAmount, 0) ?? 0;
  const completed = goals?.filter((g) => g.status === 'COMPLETED').length ?? 0;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Savings goals"
        description="Set targets for the things that matter and watch your progress grow."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New goal
          </Button>
        }
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total saved" value={format(totalSaved)} loading={isLoading} icon={<TrendingUp className="h-5 w-5" />} iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" footer={<span className="text-xs text-slate-500">{totalTarget ? ((totalSaved / totalTarget) * 100).toFixed(1) : 0}% of all targets</span>} />
            <StatCard label="Total target" value={format(totalTarget)} loading={isLoading} icon={<Target className="h-5 w-5" />} iconClass="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400" footer={<span className="text-xs text-slate-500">{format(Math.max(totalTarget - totalSaved, 0))} still to save</span>} />
            <StatCard label="Goals completed" value={`${completed} / ${goals?.length ?? 0}`} loading={isLoading} icon={<CheckCircle2 className="h-5 w-5" />} iconClass="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400" />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-80" />
              ))}
            </div>
          ) : !goals?.length ? (
            <Card>
              <EmptyState
                icon={<Target className="h-6 w-6" />}
                title="No savings goals yet"
                description="Create a goal like a new laptop, an emergency fund or a vacation, and track how close you are."
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" /> Create your first goal
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {goals.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onEdit={() => {
                    setEditing(g);
                    setFormOpen(true);
                  }}
                  onDelete={() => setDeleting(g)}
                  onContribute={() => setContributing(g)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <GoalForm open={formOpen} onClose={() => setFormOpen(false)} goal={editing} />
      <ContributeForm open={!!contributing} onClose={() => setContributing(null)} goal={contributing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete goal?"
        message={deleting && `"${deleting.name}" and its progress (${format(deleting.currentAmount)} saved) will be removed.`}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </>
  );
}

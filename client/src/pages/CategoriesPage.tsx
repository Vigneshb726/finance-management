import { useState } from 'react';
import { Lock, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { CategoryForm } from '../components/categories/CategoryForm';
import { Button } from '../components/ui/Button';
import { Badge, Card, CategoryIcon, PageHeader } from '../components/ui/Display';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/Modal';
import { useCategories, useDeleteCategory } from '../hooks/queries';
import type { Category, TransactionType } from '../types';
import { cn } from '../utils/cn';

export default function CategoriesPage() {
  const [tab, setTab] = useState<TransactionType>('EXPENSE');
  const { data = [], isLoading, isError, error, refetch } = useCategories();
  const remove = useDeleteCategory();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const list = data.filter((c) => c.type === tab);
  const custom = list.filter((c) => !c.isDefault);
  const defaults = list.filter((c) => c.isDefault);

  const renderRow = (c: Category) => (
    <li key={c.id} className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <CategoryIcon icon={c.icon} color={c.color} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
          {c.name}
          {c.isDefault && (
            <Badge>
              <Lock className="h-3 w-3" /> Default
            </Badge>
          )}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{c.transactionCount ?? 0} transaction(s)</p>
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => {
            setEditing(c);
            setFormOpen(true);
          }}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
          aria-label={`Edit ${c.name}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
        {!c.isDefault && (
          <button
            onClick={() => setDeleting(c)}
            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
            aria-label={`Delete ${c.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise transactions with default and custom categories."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New category
          </Button>
        }
      />

      <div className="mb-4 inline-flex rounded-lg border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900" role="tablist">
        {(['EXPENSE', 'INCOME'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition',
              tab === t ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            {t === 'EXPENSE' ? 'Expense' : 'Income'} ({data.filter((c) => c.type === t).length})
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Custom categories</h3>
            </div>
            {custom.length ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">{custom.map(renderRow)}</ul>
            ) : (
              <EmptyState
                icon={<Tags className="h-6 w-6" />}
                title="No custom categories"
                description="Create your own categories like Pets, Subscriptions or Gym."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" /> New category
                  </Button>
                }
              />
            )}
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Default categories</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">You can change their colour and icon; they can't be deleted.</p>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">{defaults.map(renderRow)}</ul>
          </Card>
        </div>
      )}

      <CategoryForm open={formOpen} onClose={() => setFormOpen(false)} category={editing} defaultType={tab} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete category?"
        message={
          deleting &&
          (deleting.transactionCount
            ? `"${deleting.name}" has ${deleting.transactionCount} transaction(s). They will be moved to "Other" so your totals stay correct.`
            : `"${deleting.name}" will be permanently deleted.`)
        }
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </>
  );
}

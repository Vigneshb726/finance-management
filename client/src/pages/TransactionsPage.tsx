import { useMemo, useState } from 'react';
import { FileDown, FilterX, Plus, Receipt, Search, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { TransactionForm } from '../components/transactions/TransactionForm';
import { TransactionTable } from '../components/transactions/TransactionTable';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Display';
import { EmptyState, ErrorState, Skeleton, Spinner } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { useCategories, useDeleteTransaction, useTransactions } from '../hooks/queries';
import { useCurrency } from '../hooks/useCurrency';
import { useDebounce } from '../hooks/useDebounce';
import { saveFile } from '../platform/files';
import { getErrorMessage } from '../services/api';
import { transactionsApi } from '../services/endpoints';
import type { PaymentMethod, Transaction, TransactionFilters, TransactionType } from '../types';
import { PAYMENT_METHODS } from '../utils/constants';

const initialFilters: TransactionFilters = { page: 1, pageSize: 10, sortBy: 'date', sortOrder: 'desc' };

export default function TransactionsPage() {
  const { format } = useCurrency();
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const query = useMemo(() => ({ ...filters, search: debouncedSearch || undefined }), [filters, debouncedSearch]);
  const { data, isLoading, isError, error, refetch, isFetching } = useTransactions(query);
  const { data: categories = [] } = useCategories();
  const remove = useDeleteTransaction();

  const update = (patch: Partial<TransactionFilters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const hasFilters = !!(search || filters.type || filters.categoryId || filters.paymentMethod || filters.startDate || filters.endDate);
  const visibleCategories = filters.type ? categories.filter((c) => c.type === filters.type) : categories;

  const onSort = (key: TransactionFilters['sortBy']) =>
    update({ sortBy: key, sortOrder: filters.sortBy === key && filters.sortOrder === 'desc' ? 'asc' : 'desc' });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const [exporting, setExporting] = useState(false);
  /** Exports every transaction matching the current search and filters (not just this page). */
  const exportCsv = async () => {
    setExporting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { page, pageSize, ...exportFilters } = query;
      const { filename, content } = await transactionsApi.exportCsv(exportFilters);
      const result = await saveFile({ filename, data: content, mimeType: 'text/csv', filter: { name: 'CSV file', extensions: ['csv'] } });
      if (result.status === 'saved') toast.success(result.location ? `Exported to ${result.location}` : 'CSV exported');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not export transactions'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Search, filter and manage every income and expense."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} loading={exporting} disabled={!data?.pagination.total}>
              {!exporting && <FileDown className="h-4 w-4" />} Export CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add transaction
            </Button>
          </>
        }
      />

      {/* Filters — one row above the data */}
      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <div className="relative sm:col-span-2 lg:col-span-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search description, notes or category…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setFilters((f) => ({ ...f, page: 1 }));
              }}
              aria-label="Search transactions"
            />
          </div>
          <select
            className="input lg:col-span-2"
            value={filters.type ?? ''}
            onChange={(e) => update({ type: (e.target.value || undefined) as TransactionType | undefined, categoryId: undefined })}
            aria-label="Filter by type"
          >
            <option value="">All types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </select>
          <select
            className="input lg:col-span-2"
            value={filters.categoryId ?? ''}
            onChange={(e) => update({ categoryId: e.target.value || undefined })}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!filters.type ? ` (${c.type === 'INCOME' ? 'income' : 'expense'})` : ''}
              </option>
            ))}
          </select>
          <select
            className="input lg:col-span-2"
            value={filters.paymentMethod ?? ''}
            onChange={(e) => update({ paymentMethod: (e.target.value || undefined) as PaymentMethod | undefined })}
            aria-label="Filter by payment method"
          >
            <option value="">All payment methods</option>
            {PAYMENT_METHODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            className="input lg:col-span-2"
            value={`${filters.sortBy}:${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split(':') as [TransactionFilters['sortBy'], 'asc' | 'desc'];
              update({ sortBy, sortOrder });
            }}
            aria-label="Sort by"
          >
            <option value="date:desc">Newest first</option>
            <option value="date:asc">Oldest first</option>
            <option value="amount:desc">Amount: high to low</option>
            <option value="amount:asc">Amount: low to high</option>
            <option value="description:asc">Description A–Z</option>
            <option value="category:asc">Category A–Z</option>
          </select>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-12">
            <label className="flex flex-1 items-center gap-2 text-sm text-slate-500 sm:flex-none">
              From
              <input type="date" className="input w-auto" value={filters.startDate ?? ''} max={filters.endDate} onChange={(e) => update({ startDate: e.target.value || undefined })} />
            </label>
            <label className="flex flex-1 items-center gap-2 text-sm text-slate-500 sm:flex-none">
              To
              <input type="date" className="input w-auto" value={filters.endDate ?? ''} min={filters.startDate} onChange={(e) => update({ endDate: e.target.value || undefined })} />
            </label>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  setSearch('');
                  setFilters(initialFilters);
                }}
              >
                <FilterX className="h-4 w-4" /> Clear filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Totals for the current filter */}
      {data && data.pagination.total > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Income', value: format(data.totals.income), cls: 'text-emerald-700 dark:text-emerald-400' },
            { label: 'Expenses', value: format(data.totals.expense), cls: 'text-slate-900 dark:text-white' },
            { label: 'Net', value: format(data.totals.net), cls: data.totals.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white' },
          ].map((t) => (
            <div key={t.label} className="card px-4 py-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.label}</p>
              <p className={`tabular mt-0.5 truncate text-base font-semibold sm:text-lg ${t.cls}`}>{t.value}</p>
            </div>
          ))}
        </div>
      )}

      <Card className="relative overflow-hidden">
        {isFetching && !isLoading && (
          <div className="absolute right-4 top-3 z-10">
            <Spinner className="h-4 w-4" />
          </div>
        )}
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !data?.data.length ? (
          hasFilters ? (
            <EmptyState icon={<SearchX className="h-6 w-6" />} title="No matching transactions" description="Try a different search term or clear the filters." />
          ) : (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="No transactions yet"
              description="Record your first income or expense to start tracking."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Add transaction
                </Button>
              }
            />
          )
        ) : (
          <>
            <TransactionTable
              transactions={data.data}
              sortBy={filters.sortBy}
              sortOrder={filters.sortOrder}
              onSort={onSort}
              onEdit={(t) => {
                setEditing(t);
                setFormOpen(true);
              }}
              onDelete={setDeleting}
            />
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              pageSize={data.pagination.pageSize}
              onPageChange={(page) => update({ page })}
              onPageSizeChange={(pageSize) => update({ pageSize })}
            />
          </>
        )}
      </Card>

      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} transaction={editing} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete transaction?"
        message={
          deleting && (
            <>
              <span className="font-medium text-slate-900 dark:text-white">{deleting.description}</span> ({format(deleting.amount)}) will be
              permanently removed and your totals will update.
            </>
          )
        }
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </>
  );
}

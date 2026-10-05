import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { useCategories, useSaveBudget } from '../../hooks/queries';
import { useCurrency } from '../../hooks/useCurrency';
import { getErrorMessage } from '../../services/api';
import type { Budget } from '../../types';
import { cn } from '../../utils/cn';
import { MONTHS, currencySymbol } from '../../utils/format';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  budget?: Budget | null;
  period: { year: number; month: number };
}

interface Row {
  categoryId: string;
  amount: string;
}

export function BudgetForm({ open, onClose, budget, period }: Props) {
  const { currency, format } = useCurrency();
  const { data: categories = [] } = useCategories('EXPENSE');
  const save = useSaveBudget();
  const [month, setMonth] = useState(period.month);
  const [year, setYear] = useState(period.year);
  const [total, setTotal] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setMonth(budget?.month ?? period.month);
    setYear(budget?.year ?? period.year);
    setTotal(budget ? String(budget.totalAmount) : '');
    setNotes(budget?.notes ?? '');
    setRows(budget ? budget.categories.map((c) => ({ categoryId: c.categoryId, amount: String(c.amount) })) : []);
  }, [open, budget, period.month, period.year]);

  const allocated = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalNum = Number(total) || 0;
  const overAllocated = allocated > totalNum && totalNum > 0;
  const usedIds = new Set(rows.map((r) => r.categoryId));
  const available = categories.filter((c) => !usedIds.has(c.id));

  const addRow = () => {
    if (!available.length) return;
    setRows((r) => [...r, { categoryId: available[0].id, amount: '' }]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!totalNum || totalNum <= 0) return setError('Enter a total monthly budget greater than 0');
    if (rows.some((r) => !(Number(r.amount) > 0))) return setError('Each category budget needs an amount greater than 0');
    if (overAllocated) return setError('Category allocations exceed the total budget');
    try {
      await save.mutateAsync({
        id: budget?.id,
        data: {
          month,
          year,
          totalAmount: totalNum,
          notes: notes.trim() || null,
          categories: rows.map((r) => ({ categoryId: r.categoryId, amount: Number(r.amount) })),
        },
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const nowYear = new Date().getFullYear();
  const years = Array.from(new Set([nowYear - 1, nowYear, nowYear + 1, year])).sort();

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={budget ? 'Edit budget' : 'Create monthly budget'}
      description="Set an overall spending limit and optional limits per category."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="budget-form" loading={save.isPending}>
            {budget ? 'Save budget' : 'Create budget'}
          </Button>
        </>
      }
    >
      <form id="budget-form" onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
          <Select label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Input
            label="Total budget"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="30000"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            leftIcon={<span className="text-sm">{currencySymbol(currency)}</span>}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">Category budgets</span>
            <span className={cn('tabular text-xs', overAllocated ? 'font-medium text-red-600' : 'text-slate-500 dark:text-slate-400')}>
              Allocated {format(allocated)} of {format(totalNum)}
            </span>
          </div>
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  className="input flex-1"
                  value={row.categoryId}
                  aria-label="Category"
                  onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, categoryId: e.target.value } : r)))}
                >
                  {categories
                    .filter((c) => c.id === row.categoryId || !usedIds.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <input
                  className="input w-36"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  aria-label="Category amount"
                  value={row.amount}
                  onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r)))}
                />
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((_, i) => i !== idx))}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                  aria-label="Remove category budget"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {rows.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-center text-sm text-slate-500 dark:border-slate-700">
                No category limits yet — the total budget still applies.
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={addRow} disabled={!available.length}>
            <Plus className="h-4 w-4" /> Add category limit
          </Button>
        </div>

        <Textarea label="Notes (optional)" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
      </form>
    </Modal>
  );
}

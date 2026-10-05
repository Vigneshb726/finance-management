import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useCategories, useSaveRecurring } from '../../hooks/queries';
import { useCurrency } from '../../hooks/useCurrency';
import { getErrorMessage, getFieldErrors } from '../../services/api';
import type { PaymentMethod, RecurrenceFrequency, RecurringTransaction, TransactionType } from '../../types';
import { cn } from '../../utils/cn';
import { PAYMENT_METHODS } from '../../utils/constants';
import { currencySymbol, toDateInput } from '../../utils/format';
import { describeSchedule, FREQUENCIES } from '../../utils/recurrence';
import { Button } from '../ui/Button';
import { Input, Select, Textarea, Toggle } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface FormState {
  type: TransactionType;
  amount: string;
  categoryId: string;
  description: string;
  paymentMethod: PaymentMethod;
  notes: string;
  frequency: RecurrenceFrequency;
  interval: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const emptyForm = (): FormState => ({
  type: 'EXPENSE',
  amount: '',
  categoryId: '',
  description: '',
  paymentMethod: 'UPI',
  notes: '',
  frequency: 'MONTHLY',
  interval: '1',
  startDate: toDateInput(),
  endDate: '',
  isActive: true,
});

export function RecurringForm({ open, onClose, rule }: { open: boolean; onClose: () => void; rule?: RecurringTransaction | null }) {
  const { currency } = useCurrency();
  const { data: categories = [] } = useCategories();
  const save = useSaveRecurring();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError('');
    setForm(
      rule
        ? {
            type: rule.type,
            amount: String(rule.amount),
            categoryId: rule.categoryId,
            description: rule.description,
            paymentMethod: rule.paymentMethod,
            notes: rule.notes ?? '',
            frequency: rule.frequency,
            interval: String(rule.interval),
            startDate: rule.startDate,
            endDate: rule.endDate ?? '',
            isActive: rule.isActive,
          }
        : emptyForm(),
    );
  }, [open, rule]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const amount = Number(form.amount);
    const interval = Number(form.interval);
    if (!form.amount || Number.isNaN(amount) || amount <= 0) e.amount = 'Enter an amount greater than 0';
    if (!form.categoryId) e.categoryId = 'Choose a category';
    if (!form.description.trim()) e.description = 'Description is required';
    if (!form.startDate) e.startDate = 'Start date is required';
    if (!Number.isInteger(interval) || interval < 1 || interval > 365) e.interval = 'Enter a whole number from 1 to 365';
    if (form.endDate && form.endDate < form.startDate) e.endDate = 'End date must be on or after the start date';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setFormError('');
    try {
      await save.mutateAsync({
        id: rule?.id,
        data: {
          type: form.type,
          amount: Number(form.amount),
          categoryId: form.categoryId,
          description: form.description.trim(),
          paymentMethod: form.paymentMethod,
          notes: form.notes.trim() || null,
          frequency: form.frequency,
          interval: Number(form.interval),
          startDate: form.startDate,
          endDate: form.endDate || null,
          isActive: form.isActive,
        },
      });
      onClose();
    } catch (err) {
      setErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err));
    }
  };

  const unit = FREQUENCIES.find((f) => f.value === form.frequency)?.unit ?? 'month';
  const past = !rule && form.startDate && form.startDate < toDateInput();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rule ? 'Edit recurring transaction' : 'New recurring transaction'}
      description="Salary, rent, subscriptions — added automatically on schedule."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="recurring-form" loading={save.isPending}>
            {rule ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <form id="recurring-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="radiogroup" aria-label="Transaction type">
          {(['EXPENSE', 'INCOME'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={form.type === t}
              onClick={() => setForm((f) => ({ ...f, type: t, categoryId: f.type === t ? f.categoryId : '' }))}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition',
                form.type === t
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
              )}
            >
              {t === 'EXPENSE' ? <ArrowUpRight className="h-4 w-4 text-red-500" /> : <ArrowDownLeft className="h-4 w-4 text-emerald-500" />}
              {t === 'EXPENSE' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            error={errors.amount}
            leftIcon={<span className="text-sm">{currencySymbol(currency)}</span>}
          />
          <Select label="Category" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} error={errors.categoryId}>
            <option value="">Select category</option>
            {categories
              .filter((c) => c.type === form.type)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </div>

        <Input
          label="Description"
          placeholder={form.type === 'EXPENSE' ? 'e.g. House rent' : 'e.g. Monthly salary'}
          value={form.description}
          maxLength={200}
          onChange={(e) => set('description', e.target.value)}
          error={errors.description}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Repeats" value={form.frequency} onChange={(e) => set('frequency', e.target.value as RecurrenceFrequency)}>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
          <Input
            label={`Every how many ${unit}s`}
            type="number"
            inputMode="numeric"
            min="1"
            max="365"
            step="1"
            value={form.interval}
            onChange={(e) => set('interval', e.target.value)}
            error={errors.interval}
            hint={describeSchedule(form.frequency, Math.max(Number(form.interval) || 1, 1))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First occurrence"
            type="date"
            value={form.startDate}
            onChange={(e) => set('startDate', e.target.value)}
            error={errors.startDate}
            hint={past ? 'Past occurrences up to today will be added right away.' : undefined}
          />
          <Input
            label="End date (optional)"
            type="date"
            value={form.endDate}
            min={form.startDate}
            onChange={(e) => set('endDate', e.target.value)}
            error={errors.endDate}
            hint="Leave empty to repeat indefinitely."
          />
        </div>

        <Select label="Payment method" value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value as PaymentMethod)}>
          {PAYMENT_METHODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>

        <Textarea
          label="Notes (optional)"
          value={form.notes}
          maxLength={1000}
          onChange={(e) => set('notes', e.target.value)}
        />

        <Toggle
          label="Active"
          description="Paused rules create nothing. Resuming continues from today without back-filling the pause."
          checked={form.isActive}
          onChange={(v) => set('isActive', v)}
        />

        {formError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{formError}</p>
        )}
      </form>
    </Modal>
  );
}

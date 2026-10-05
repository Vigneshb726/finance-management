import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useCategories, useSaveTransaction } from '../../hooks/queries';
import { useCurrency } from '../../hooks/useCurrency';
import { getErrorMessage, getFieldErrors } from '../../services/api';
import type { PaymentMethod, Transaction, TransactionType } from '../../types';
import { cn } from '../../utils/cn';
import { PAYMENT_METHODS } from '../../utils/constants';
import { currencySymbol, toDateInput } from '../../utils/format';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  defaultType?: TransactionType;
}

interface FormState {
  type: TransactionType;
  amount: string;
  categoryId: string;
  description: string;
  date: string;
  paymentMethod: PaymentMethod;
  notes: string;
}

const emptyForm = (type: TransactionType): FormState => ({
  type,
  amount: '',
  categoryId: '',
  description: '',
  date: toDateInput(),
  paymentMethod: 'UPI',
  notes: '',
});

export function TransactionForm({ open, onClose, transaction, defaultType = 'EXPENSE' }: Props) {
  const { currency } = useCurrency();
  const { data: categories = [] } = useCategories();
  const save = useSaveTransaction();
  const [form, setForm] = useState<FormState>(emptyForm(defaultType));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError('');
    setForm(
      transaction
        ? {
            type: transaction.type,
            amount: String(transaction.amount),
            categoryId: transaction.categoryId,
            description: transaction.description,
            date: transaction.date,
            paymentMethod: transaction.paymentMethod,
            notes: transaction.notes ?? '',
          }
        : emptyForm(defaultType),
    );
  }, [open, transaction, defaultType]);

  const typeCategories = categories.filter((c) => c.type === form.type);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const amount = Number(form.amount);
    if (!form.amount || Number.isNaN(amount) || amount <= 0) e.amount = 'Enter an amount greater than 0';
    if (!form.categoryId) e.categoryId = 'Choose a category';
    if (!form.description.trim()) e.description = 'Description is required';
    if (!form.date) e.date = 'Date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setFormError('');
    try {
      await save.mutateAsync({
        id: transaction?.id,
        data: {
          type: form.type,
          amount: Number(form.amount),
          categoryId: form.categoryId,
          description: form.description.trim(),
          date: form.date,
          paymentMethod: form.paymentMethod,
          notes: form.notes.trim() || null,
        },
      });
      onClose();
    } catch (err) {
      setErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={transaction ? 'Edit transaction' : 'Add transaction'}
      description="Record money coming in or going out."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="transaction-form" loading={save.isPending}>
            {transaction ? 'Save changes' : 'Add transaction'}
          </Button>
        </>
      }
    >
      <form id="transaction-form" onSubmit={submit} className="space-y-4" noValidate>
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
          <Input label="Date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} error={errors.date} />
        </div>

        <Input
          label="Description"
          placeholder={form.type === 'EXPENSE' ? 'e.g. Groceries at BigBasket' : 'e.g. Monthly salary'}
          value={form.description}
          maxLength={200}
          onChange={(e) => set('description', e.target.value)}
          error={errors.description}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Category" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} error={errors.categoryId}>
            <option value="">Select category</option>
            {typeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            label="Payment method"
            value={form.paymentMethod}
            onChange={(e) => set('paymentMethod', e.target.value as PaymentMethod)}
          >
            {PAYMENT_METHODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>

        <Textarea
          label="Notes (optional)"
          placeholder="Any extra details"
          value={form.notes}
          maxLength={1000}
          onChange={(e) => set('notes', e.target.value)}
        />

        {formError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{formError}</p>
        )}
      </form>
    </Modal>
  );
}

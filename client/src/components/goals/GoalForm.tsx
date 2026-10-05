import { useEffect, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { useContributeGoal, useSaveGoal } from '../../hooks/queries';
import { useCurrency } from '../../hooks/useCurrency';
import { getErrorMessage } from '../../services/api';
import type { Goal } from '../../types';
import { COLOR_SWATCHES } from '../../utils/constants';
import { currencySymbol } from '../../utils/format';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
      {COLOR_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className="flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:ring-offset-slate-900"
          style={{ backgroundColor: c }}
        >
          {value === c && <Check className="h-4 w-4 text-white" />}
        </button>
      ))}
    </div>
  );
}

export function GoalForm({ open, onClose, goal }: { open: boolean; onClose: () => void; goal?: Goal | null }) {
  const { currency } = useCurrency();
  const save = useSaveGoal();
  const [form, setForm] = useState({ name: '', targetAmount: '', currentAmount: '', targetDate: '', description: '', color: '#4f46e5' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError('');
    setForm({
      name: goal?.name ?? '',
      targetAmount: goal ? String(goal.targetAmount) : '',
      currentAmount: goal ? String(goal.currentAmount) : '',
      targetDate: goal?.targetDate ?? '',
      description: goal?.description ?? '',
      color: goal?.color ?? '#4f46e5',
    });
  }, [open, goal]);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Goal name is required';
    if (!(Number(form.targetAmount) > 0)) errs.targetAmount = 'Target must be greater than 0';
    if (form.currentAmount && Number(form.currentAmount) < 0) errs.currentAmount = 'Cannot be negative';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      await save.mutateAsync({
        id: goal?.id,
        data: {
          name: form.name.trim(),
          targetAmount: Number(form.targetAmount),
          currentAmount: Number(form.currentAmount) || 0,
          targetDate: form.targetDate || null,
          description: form.description.trim() || null,
          color: form.color,
        },
      });
      onClose();
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  const symbol = <span className="text-sm">{currencySymbol(currency)}</span>;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? 'Edit goal' : 'New savings goal'}
      description="Set a target and track your progress towards it."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="goal-form" loading={save.isPending}>
            {goal ? 'Save goal' : 'Create goal'}
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Goal name" placeholder="e.g. New Laptop" value={form.name} maxLength={80} onChange={(e) => set('name', e.target.value)} error={errors.name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Target amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="80000"
            value={form.targetAmount}
            onChange={(e) => set('targetAmount', e.target.value)}
            error={errors.targetAmount}
            leftIcon={symbol}
          />
          <Input
            label="Saved so far"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={form.currentAmount}
            onChange={(e) => set('currentAmount', e.target.value)}
            error={errors.currentAmount}
            leftIcon={symbol}
          />
        </div>
        <Input label="Target date (optional)" type="date" value={form.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
        <Textarea label="Description (optional)" value={form.description} maxLength={500} onChange={(e) => set('description', e.target.value)} />
        <div>
          <span className="label">Colour</span>
          <ColorPicker value={form.color} onChange={(c) => set('color', c)} />
        </div>
        {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{formError}</p>}
      </form>
    </Modal>
  );
}

export function ContributeForm({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: Goal | null }) {
  const { currency, format } = useCurrency();
  const contribute = useContributeGoal();
  const [mode, setMode] = useState<'add' | 'withdraw'>('add');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setAmount('');
      setError('');
      setMode('add');
    }
  }, [open]);

  if (!goal) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!(value > 0)) return setError('Enter an amount greater than 0');
    if (mode === 'withdraw' && value > goal.currentAmount) return setError(`You can withdraw at most ${format(goal.currentAmount)}`);
    try {
      await contribute.mutateAsync({ id: goal.id, amount: mode === 'add' ? value : -value });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Update "${goal.name}"`}
      description={`${format(goal.currentAmount)} saved of ${format(goal.targetAmount)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="contribute-form" loading={contribute.isPending}>
            {mode === 'add' ? 'Add money' : 'Withdraw'}
          </Button>
        </>
      }
    >
      <form id="contribute-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['add', 'withdraw'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg py-1.5 text-sm font-medium transition ${
                mode === m ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500'
              }`}
            >
              {m === 'add' ? 'Add money' : 'Withdraw'}
            </button>
          ))}
        </div>
        <Input
          label="Amount"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError('');
          }}
          error={error}
          leftIcon={<span className="text-sm">{currencySymbol(currency)}</span>}
        />
      </form>
    </Modal>
  );
}

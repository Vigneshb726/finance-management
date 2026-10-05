import { useEffect, useState, type FormEvent } from 'react';
import { useSaveCategory } from '../../hooks/queries';
import { getErrorMessage } from '../../services/api';
import type { Category, TransactionType } from '../../types';
import { cn } from '../../utils/cn';
import { CATEGORY_ICONS } from '../../utils/constants';
import { ColorPicker } from '../goals/GoalForm';
import { Button } from '../ui/Button';
import { CategoryIcon } from '../ui/Display';
import { Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  category?: Category | null;
  defaultType?: TransactionType;
}

export function CategoryForm({ open, onClose, category, defaultType = 'EXPENSE' }: Props) {
  const save = useSaveCategory();
  const [name, setName] = useState('');
  const [type, setType] = useState<TransactionType>(defaultType);
  const [color, setColor] = useState('#4f46e5');
  const [icon, setIcon] = useState('tag');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setName(category?.name ?? '');
    setType(category?.type ?? defaultType);
    setColor(category?.color ?? '#4f46e5');
    setIcon(category?.icon ?? 'tag');
  }, [open, category, defaultType]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required');
    try {
      await save.mutateAsync({ id: category?.id, data: { name: name.trim(), type, color, icon } });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" loading={save.isPending}>
            {category ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <CategoryIcon icon={icon} color={color} size="lg" />
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{name || 'Category name'}</p>
            <p className="text-xs text-slate-500">{type === 'EXPENSE' ? 'Expense' : 'Income'} category</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            value={name}
            maxLength={40}
            disabled={category?.isDefault}
            hint={category?.isDefault ? 'Default categories cannot be renamed' : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
          />
          <Select label="Type" value={type} disabled={!!category} onChange={(e) => setType(e.target.value as TransactionType)}>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </Select>
        </div>
        <div>
          <span className="label">Icon</span>
          <div className="grid grid-cols-8 gap-1.5">
            {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                aria-label={key}
                aria-pressed={icon === key}
                className={cn(
                  'flex h-9 items-center justify-center rounded-lg border transition',
                  icon === key
                    ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10'
                    : 'border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Colour</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
      </form>
    </Modal>
  );
}

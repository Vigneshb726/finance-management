import type { ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { CATEGORY_ICONS } from '../../utils/constants';
import type { BudgetStatus } from '../../types';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card', className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
const tones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400',
  danger: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}

/** Budget status always pairs colour with an icon and a label. */
export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  if (status === 'EXCEEDED')
    return (
      <Badge tone="danger">
        <XCircle className="h-3 w-3" /> Exceeded
      </Badge>
    );
  if (status === 'WARNING')
    return (
      <Badge tone="warning">
        <AlertTriangle className="h-3 w-3" /> Near limit
      </Badge>
    );
  return (
    <Badge tone="success">
      <CheckCircle2 className="h-3 w-3" /> On track
    </Badge>
  );
}

const statusBar: Record<BudgetStatus, string> = {
  ON_TRACK: 'bg-[var(--status-good)]',
  WARNING: 'bg-[var(--status-warning)]',
  EXCEEDED: 'bg-[var(--status-critical)]',
};

export function ProgressBar({
  value,
  status,
  color,
  className,
  label,
}: {
  value: number;
  status?: BudgetStatus;
  color?: string;
  className?: string;
  label?: string;
}) {
  const width = Math.min(Math.max(value, 0), 100);
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800', className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', status ? statusBar[status] : !color && 'bg-brand-600')}
        style={{ width: `${width}%`, ...(color && !status ? { backgroundColor: color } : {}) }}
      />
    </div>
  );
}

export function CategoryIcon({ icon, color, size = 'md' }: { icon: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = CATEGORY_ICONS[icon] ?? CATEGORY_ICONS.tag;
  const box = { sm: 'h-7 w-7 rounded-lg', md: 'h-9 w-9 rounded-xl', lg: 'h-11 w-11 rounded-xl' }[size];
  const glyph = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' }[size];
  return (
    <span className={cn('flex shrink-0 items-center justify-center', box)} style={{ backgroundColor: `${color}1f`, color }}>
      <Icon className={glyph} aria-hidden />
    </span>
  );
}

export function Delta({ value, invert = false, suffix = 'vs last month' }: { value: number | null; invert?: boolean; suffix?: string }) {
  if (value === null) return <span className="text-xs text-slate-400">No data for last month</span>;
  const up = value >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 font-medium',
          good ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {Math.abs(value).toFixed(1)}%
      </span>
      <span className="text-slate-500 dark:text-slate-400">{suffix}</span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  iconClass,
  footer,
  loading,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  iconClass?: string;
  footer?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', iconClass)}>{icon}</span>
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-32 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
      ) : (
        <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
      )}
      {footer && <div className="mt-2 min-h-[18px]">{footer}</div>}
    </div>
  );
}

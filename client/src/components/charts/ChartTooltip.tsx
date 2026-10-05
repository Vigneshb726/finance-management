import type { TooltipProps } from 'recharts';

interface ChartTooltipProps extends TooltipProps<number, string> {
  formatValue: (v: number) => string;
  formatLabel?: (label: string, row: Record<string, unknown>) => string;
  footer?: (payload: Record<string, unknown>) => string | null;
}

/** Shared tooltip: values in text ink, a coloured swatch carries series identity. */
export function ChartTooltip({ active, payload, label, formatValue, formatLabel, footer }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Record<string, unknown>;
  const extra = footer?.(row);
  return (
    <div className="min-w-[170px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-pop backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <p className="mb-1.5 font-medium text-slate-900 dark:text-white">{formatLabel ? formatLabel(String(label), row) : label}</p>
      <div className="space-y-1">
        {payload
          .filter((p) => p.value !== null && p.value !== undefined)
          .map((p) => (
            <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
                {p.name}
              </span>
              <span className="tabular font-medium text-slate-900 dark:text-white">{formatValue(Number(p.value))}</span>
            </div>
          ))}
      </div>
      {extra && <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-slate-500 dark:border-slate-800 dark:text-slate-400">{extra}</p>}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.dashed ? (
            <span className="h-0 w-3.5 border-t-2 border-dashed" style={{ borderColor: i.color }} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

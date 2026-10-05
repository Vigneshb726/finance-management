import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCurrency } from '../../hooks/useCurrency';
import type { MonthlyPoint } from '../../types';
import { shortMonth } from '../../utils/format';
import { ChartTooltip, Legend } from './ChartTooltip';
import { axisProps, useChartTheme } from './chartTheme';

/** Income, expenses and net savings over time — one axis, 2px lines, crosshair tooltip. */
export function TrendChart({ data, height = 300 }: { data: MonthlyPoint[]; height?: number }) {
  const theme = useChartTheme();
  const { format } = useCurrency();
  const series = [
    { key: 'income', label: 'Income', color: theme.income },
    { key: 'expense', label: 'Expenses', color: theme.expense },
    { key: 'savings', label: 'Net savings', color: theme.savings },
  ];

  return (
    <div>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      <div style={{ height }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="month" tickFormatter={(v) => shortMonth(v)} {...axisProps(theme.axis)} />
            <YAxis width={56} tickFormatter={(v) => format(v, { compact: true })} {...axisProps(theme.axis)} />
            <Tooltip
              cursor={{ stroke: theme.axis, strokeWidth: 1, strokeDasharray: '3 3' }}
              content={<ChartTooltip formatValue={(v) => format(v)} formatLabel={(l) => shortMonth(l, true)} />}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                isAnimationActive={theme.animate}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: theme.surface }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

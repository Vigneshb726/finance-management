import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCurrency } from '../../hooks/useCurrency';
import type { MonthlyPoint } from '../../types';
import { shortMonth } from '../../utils/format';
import { ChartTooltip, Legend } from './ChartTooltip';
import { axisProps, useChartTheme } from './chartTheme';

/** Monthly spending against the monthly budget (same currency axis). */
export function BudgetPerformanceChart({ data, height = 280 }: { data: MonthlyPoint[]; height?: number }) {
  const theme = useChartTheme();
  const { format } = useCurrency();

  return (
    <div>
      <Legend
        items={[
          { label: 'Spent', color: theme.expense },
          { label: 'Budget', color: theme.budget, dashed: true },
        ]}
      />
      <div style={{ height }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="month" tickFormatter={(v) => shortMonth(v)} {...axisProps(theme.axis)} />
            <YAxis width={56} tickFormatter={(v) => format(v, { compact: true })} {...axisProps(theme.axis)} />
            <Tooltip
              cursor={{ fill: theme.cursor }}
              content={
                <ChartTooltip
                  formatValue={(v) => format(v)}
                  formatLabel={(l) => shortMonth(l, true)}
                  footer={(p) => (p.budgetUsage != null ? `${p.budgetUsage}% of budget used` : 'No budget set')}
                />
              }
            />
            <Bar isAnimationActive={theme.animate} dataKey="expense" name="Spent" fill={theme.expense} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Line
              isAnimationActive={theme.animate}
              type="linear"
              dataKey="budget"
              name="Budget"
              stroke={theme.budget}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 4, strokeWidth: 2, stroke: theme.surface, fill: theme.budget, strokeDasharray: '' }}
              activeDot={{ r: 4, strokeWidth: 2, stroke: theme.surface }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

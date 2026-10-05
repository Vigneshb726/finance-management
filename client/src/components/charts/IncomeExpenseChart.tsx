import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCurrency } from '../../hooks/useCurrency';
import type { MonthlyPoint } from '../../types';
import { shortMonth } from '../../utils/format';
import { ChartTooltip, Legend } from './ChartTooltip';
import { axisProps, useChartTheme } from './chartTheme';

export function IncomeExpenseChart({ data, height = 280 }: { data: MonthlyPoint[]; height?: number }) {
  const theme = useChartTheme();
  const { format } = useCurrency();

  return (
    <div>
      <Legend
        items={[
          { label: 'Income', color: theme.income },
          { label: 'Expenses', color: theme.expense },
        ]}
      />
      <div style={{ height }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="month" tickFormatter={(v) => shortMonth(v)} {...axisProps(theme.axis)} />
            <YAxis width={56} tickFormatter={(v) => format(v, { compact: true })} {...axisProps(theme.axis)} />
            <Tooltip
              cursor={{ fill: theme.cursor }}
              content={
                <ChartTooltip
                  formatValue={(v) => format(v)}
                  formatLabel={(l) => shortMonth(l, true)}
                  footer={(p) => `Net: ${format(Number(p.savings))}`}
                />
              }
            />
            <Bar isAnimationActive={theme.animate} dataKey="income" name="Income" fill={theme.income} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar isAnimationActive={theme.animate} dataKey="expense" name="Expenses" fill={theme.expense} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

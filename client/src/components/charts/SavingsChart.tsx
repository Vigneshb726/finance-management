import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCurrency } from '../../hooks/useCurrency';
import type { MonthlyPoint } from '../../types';
import { shortMonth } from '../../utils/format';
import { ChartTooltip, Legend } from './ChartTooltip';
import { axisProps, useChartTheme } from './chartTheme';

/** Net savings per month; months with a deficit are drawn in the negative colour. */
export function SavingsChart({ data, height = 280 }: { data: MonthlyPoint[]; height?: number }) {
  const theme = useChartTheme();
  const { format } = useCurrency();

  return (
    <div>
      <Legend
        items={[
          { label: 'Saved', color: theme.savings },
          { label: 'Deficit', color: theme.negative },
        ]}
      />
      <div style={{ height }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="month" tickFormatter={(v) => shortMonth(v)} {...axisProps(theme.axis)} />
            <YAxis width={56} tickFormatter={(v) => format(v, { compact: true })} {...axisProps(theme.axis)} />
            <ReferenceLine y={0} stroke={theme.axis} />
            <Tooltip
              cursor={{ fill: theme.cursor }}
              content={
                <ChartTooltip
                  formatValue={(v) => format(v)}
                  formatLabel={(l) => shortMonth(l, true)}
                  footer={(p) => `Savings rate ${p.savingsRate}% · Cumulative ${format(Number(p.cumulativeSavings))}`}
                />
              }
            />
            <Bar isAnimationActive={theme.animate} dataKey="savings" name="Net savings" radius={[4, 4, 4, 4]} maxBarSize={28}>
              {data.map((d) => (
                <Cell key={d.month} fill={d.savings >= 0 ? theme.savings : theme.negative} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

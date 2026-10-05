import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCurrency } from '../../hooks/useCurrency';
import type { DailyPoint } from '../../types';
import { formatDate } from '../../utils/format';
import { ChartTooltip } from './ChartTooltip';
import { axisProps, useChartTheme } from './chartTheme';

/** Cumulative spending through the month, optionally against the monthly budget. */
export function DailySpendingChart({ data, budget, height = 260 }: { data: DailyPoint[]; budget?: number | null; height?: number }) {
  const theme = useChartTheme();
  const { format } = useCurrency();

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.expense} stopOpacity={0.22} />
              <stop offset="100%" stopColor={theme.expense} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis dataKey="day" interval="preserveStartEnd" minTickGap={16} {...axisProps(theme.axis)} />
          <YAxis width={56} tickFormatter={(v) => format(v, { compact: true })} {...axisProps(theme.axis)} />
          {budget ? (
            <ReferenceLine
              y={budget}
              stroke={theme.budget}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{ value: `Budget ${format(budget, { compact: true })}`, position: 'insideTopRight', fill: theme.axis, fontSize: 11 }}
            />
          ) : null}
          <Tooltip
            cursor={{ stroke: theme.axis, strokeWidth: 1, strokeDasharray: '3 3' }}
            content={
              <ChartTooltip
                formatValue={(v) => format(v)}
                formatLabel={(_l, row) => formatDate(String(row.date), { weekday: 'short', day: 'numeric', month: 'short' })}
              />
            }
          />
          <Area
            isAnimationActive={theme.animate}
            type="monotone"
            dataKey="cumulativeExpense"
            name="Spent so far"
            stroke={theme.expense}
            strokeWidth={2}
            fill="url(#spendFill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: theme.surface }}
          />
          <Area isAnimationActive={theme.animate} type="monotone" dataKey="expense" name="Spent that day" stroke="none" fill="none" activeDot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

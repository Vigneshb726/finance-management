import { useTheme } from '../../context/ThemeContext';

/**
 * Chart colours — validated categorical slots (blue / orange / aqua) with
 * selected dark-mode steps, plus recessive grid & axis ink.
 */
const light = {
  income: '#2a78d6',
  expense: '#eb6834',
  savings: '#1baf7a',
  budget: '#898781',
  negative: '#d03b3b',
  grid: '#e8eaed',
  axis: '#898781',
  surface: '#ffffff',
  cursor: 'rgba(15, 23, 42, 0.04)',
};

const dark: typeof light = {
  income: '#3987e5',
  expense: '#d95926',
  savings: '#199e70',
  budget: '#898781',
  negative: '#e66767',
  grid: '#1f2937',
  axis: '#898781',
  surface: '#0f172a',
  cursor: 'rgba(255, 255, 255, 0.04)',
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useChartTheme() {
  const { isDark } = useTheme();
  // Respect the OS "reduce motion" setting by skipping chart entry animations
  return { ...(isDark ? dark : light), animate: !prefersReducedMotion() };
}

export const axisProps = (color: string) => ({
  tick: { fill: color, fontSize: 12 },
  tickLine: false,
  axisLine: false,
});

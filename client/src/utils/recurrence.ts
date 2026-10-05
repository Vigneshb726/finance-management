import type { RecurrenceFrequency } from '../types';

export const FREQUENCIES: { value: RecurrenceFrequency; label: string; unit: string }[] = [
  { value: 'DAILY', label: 'Daily', unit: 'day' },
  { value: 'WEEKLY', label: 'Weekly', unit: 'week' },
  { value: 'MONTHLY', label: 'Monthly', unit: 'month' },
  { value: 'YEARLY', label: 'Yearly', unit: 'year' },
];

/** "Every month", "Every 2 weeks" … */
export function describeSchedule(frequency: RecurrenceFrequency, interval: number) {
  const unit = FREQUENCIES.find((f) => f.value === frequency)?.unit ?? 'period';
  return interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
}

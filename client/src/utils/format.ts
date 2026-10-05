const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, compact: boolean) {
  const key = `${currency}-${compact}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 2,
      minimumFractionDigits: 0,
    });
    formatterCache.set(key, f);
  }
  return f;
}

export function formatCurrency(amount: number, currency = 'INR', opts: { compact?: boolean; signed?: boolean } = {}) {
  const value = getFormatter(currency, !!opts.compact).format(Math.abs(amount));
  if (amount < 0) return `−${value}`;
  return opts.signed && amount > 0 ? `+${value}` : value;
}

export function currencySymbol(currency = 'INR') {
  return (
    getFormatter(currency, false)
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency
  );
}

export const formatPercent = (value: number, digits = 1) =>
  `${Number.isInteger(value) ? value : value.toFixed(digits)}%`;

/** "2026-10-05" → "5 Oct 2026" (dates are calendar dates, so no timezone shift) */
export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', opts);
}

export function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const monthLabel = (year: number, month: number, short = false) =>
  `${short ? MONTHS[month - 1].slice(0, 3) : MONTHS[month - 1]} ${year}`;

/** "2026-05" → "May" (or "May 26" with year) */
export function shortMonth(key: string, withYear = false) {
  const [y, m] = key.split('-').map(Number);
  return withYear ? `${MONTHS[m - 1].slice(0, 3)} ’${String(y).slice(2)}` : MONTHS[m - 1].slice(0, 3);
}

/** Local calendar date as YYYY-MM-DD */
export function toDateInput(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function shiftPeriod(p: { year: number; month: number }, delta: number) {
  const index = p.year * 12 + (p.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthBounds(p: { year: number; month: number }) {
  const last = new Date(p.year, p.month, 0).getDate();
  const mm = String(p.month).padStart(2, '0');
  return { startDate: `${p.year}-${mm}-01`, endDate: `${p.year}-${mm}-${String(last).padStart(2, '0')}` };
}

import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';

/** Formats amounts in the signed-in user's preferred currency (default INR). */
export function useCurrency() {
  const { user } = useAuth();
  const currency = user?.currency ?? 'INR';
  const format = useCallback(
    (amount: number, opts?: { compact?: boolean; signed?: boolean }) => formatCurrency(amount, currency, opts),
    [currency],
  );
  return { currency, format };
}

/**
 * Money is stored as integer paise (1/100 of the currency unit) in every database,
 * so sums never accumulate floating-point error. The API and UI work in rupees.
 */

/** Rupees → paise (rounded to the nearest paisa). */
export const toPaise = (amount: number): number => Math.round(amount * 100);

/** Paise → rupees. Accepts the string/bigint forms some drivers return for aggregates. */
export const fromPaise = (paise: number | string | bigint | null | undefined): number =>
  paise == null ? 0 : Number(paise) / 100;

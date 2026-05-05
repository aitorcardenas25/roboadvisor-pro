/**
 * Time-series data quality validation.
 * Used before feeding external price data into quant models.
 */

export interface PricePoint {
  date: string;  // ISO 8601
  close: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    n: number;
    gaps: number;         // missing trading-day gaps
    outliers: number;     // returns beyond threshold
    duplicates: number;
  };
}

const MAX_DAILY_RETURN_PCT = 30; // flag daily moves > 30% as outliers
const MAX_GAP_DAYS = 5;          // gaps > 5 calendar days (excl. weekends)

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

/**
 * Validates a price series for use in quant calculations.
 * Returns errors (blocking) and warnings (informational).
 */
export function validateTimeSeries(prices: PricePoint[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let gaps = 0;
  let outliers = 0;
  let duplicates = 0;

  if (prices.length === 0) {
    return {
      valid: false,
      errors: ['Sèrie buida — no hi ha dades de preus'],
      warnings: [],
      stats: { n: 0, gaps: 0, outliers: 0, duplicates: 0 },
    };
  }

  if (prices.length < 12) {
    errors.push(`Sèrie massa curta (${prices.length} punts); mínim 12 per a càlculs fiables`);
  }

  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));

  const seenDates = new Set<string>();
  for (const p of sorted) {
    if (seenDates.has(p.date)) {
      duplicates++;
    }
    seenDates.add(p.date);

    if (!isFinite(p.close) || p.close <= 0) {
      errors.push(`Preu invàlid el ${p.date}: ${p.close}`);
    }
  }

  if (duplicates > 0) {
    errors.push(`${duplicates} dates duplicades detectades`);
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    // Gap check (skip weekends naturally by allowing up to MAX_GAP_DAYS)
    const gap = daysBetween(prev.date, curr.date);
    if (gap > MAX_GAP_DAYS) {
      gaps++;
      warnings.push(`Gap de ${Math.round(gap)} dies entre ${prev.date} i ${curr.date}`);
    }

    // Outlier check on daily return
    if (prev.close > 0) {
      const ret = ((curr.close - prev.close) / prev.close) * 100;
      if (Math.abs(ret) > MAX_DAILY_RETURN_PCT) {
        outliers++;
        warnings.push(
          `Retorn atípic del ${ret.toFixed(1)}% el ${curr.date} (llindar: ±${MAX_DAILY_RETURN_PCT}%)`,
        );
      }
    }
  }

  if (gaps > sorted.length * 0.05) {
    errors.push(`Massa gaps (${gaps}): >5% dels períodes falten dades`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: { n: sorted.length, gaps, outliers, duplicates },
  };
}

/**
 * Converts a validated price series into monthly % returns.
 * Assumes prices are sorted ascending by date.
 */
export function priceToMonthlyReturns(prices: PricePoint[]): number[] {
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const returns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].close;
    const curr = sorted[i].close;
    if (prev > 0) {
      returns.push(((curr - prev) / prev) * 100);
    }
  }
  return returns;
}

/**
 * Fills small gaps using linear interpolation between known values.
 * Only fills gaps of 1–2 missing periods; larger gaps are left as-is.
 */
export function interpolateGaps(prices: PricePoint[]): PricePoint[] {
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const result: PricePoint[] = [...sorted];

  for (let i = 1; i < result.length; i++) {
    const gap = daysBetween(result[i - 1].date, result[i].date);
    if (gap > 1 && gap <= 3) {
      const steps = Math.round(gap);
      const startClose = result[i - 1].close;
      const endClose = result[i].close;
      const startMs = new Date(result[i - 1].date).getTime();
      const dayMs = 86_400_000;
      for (let s = 1; s < steps; s++) {
        const date = new Date(startMs + s * dayMs).toISOString().slice(0, 10);
        const close = startClose + (endClose - startClose) * (s / steps);
        result.splice(i, 0, { date, close });
        i++;
      }
    }
  }

  return result;
}

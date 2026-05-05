import { describe, it, expect } from 'vitest';
import {
  validateTimeSeries,
  priceToMonthlyReturns,
  interpolateGaps,
  type PricePoint,
} from '@/lib/dataValidation';

function makePrices(n: number, start = 100, dailyPct = 0): PricePoint[] {
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(Date.UTC(2023, 0, i + 1)).toISOString().slice(0, 10),
    close: start * Math.pow(1 + dailyPct / 100, i),
  }));
}

describe('validateTimeSeries', () => {
  it('sèrie buida → invàlid', () => {
    const r = validateTimeSeries([]);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('sèrie curta (<12) → error', () => {
    const r = validateTimeSeries(makePrices(5));
    expect(r.valid).toBe(false);
  });

  it('sèrie de 30 preus vàlids → valid: true', () => {
    const r = validateTimeSeries(makePrices(30));
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('preu negatiu → error', () => {
    const prices = makePrices(20);
    prices[10] = { ...prices[10], close: -5 };
    const r = validateTimeSeries(prices);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('invàlid'))).toBe(true);
  });

  it('date duplicada → error', () => {
    const prices = makePrices(20);
    prices.push({ ...prices[5] }); // duplicate
    const r = validateTimeSeries(prices);
    expect(r.valid).toBe(false);
    expect(r.stats.duplicates).toBeGreaterThan(0);
  });

  it('detecta outlier de >30% en un dia', () => {
    const prices = makePrices(30);
    prices[15] = { ...prices[15], close: prices[14].close * 2.5 }; // +150%
    const r = validateTimeSeries(prices);
    expect(r.stats.outliers).toBeGreaterThan(0);
    expect(r.warnings.some(w => w.includes('atípic'))).toBe(true);
  });
});

describe('priceToMonthlyReturns', () => {
  it('creixement constant → retorns positius constants', () => {
    const prices = makePrices(13, 100, 1); // +1% each day
    const returns = priceToMonthlyReturns(prices);
    expect(returns.length).toBe(12);
    returns.forEach(r => expect(r).toBeCloseTo(1, 2));
  });

  it('preu constant → retorn 0', () => {
    const prices = makePrices(13, 100, 0);
    const returns = priceToMonthlyReturns(prices);
    returns.forEach(r => expect(r).toBeCloseTo(0, 6));
  });
});

describe('interpolateGaps', () => {
  it('sèrie sense gaps → retorna la mateixa longitud', () => {
    const prices = makePrices(10);
    const result = interpolateGaps(prices);
    expect(result.length).toBe(prices.length);
  });

  it('gap de 2 dies → omple 1 punt intermedi', () => {
    const prices: PricePoint[] = [
      { date: '2023-01-01', close: 100 },
      { date: '2023-01-04', close: 106 }, // 3-day gap
    ];
    const result = interpolateGaps(prices);
    expect(result.length).toBeGreaterThan(2);
    // valors intermedis han d'estar entre 100 i 106
    for (const p of result) {
      expect(p.close).toBeGreaterThanOrEqual(100);
      expect(p.close).toBeLessThanOrEqual(106);
    }
  });
});

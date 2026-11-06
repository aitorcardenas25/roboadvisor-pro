// Regressió: abans, un producte amb només el 50% de l'històric es comptava com
// a "dades reals" i la resta de mesos s'omplia amb rendiments aleatoris.
import { describe, it, expect } from 'vitest';
import { runBacktest } from '@/lib/backtest';
import { FINANCIAL_PRODUCTS } from '@/lib/products';
import type { Portfolio } from '@/lib/portfolio';

const [p1, p2] = FINANCIAL_PRODUCTS;

const portfolio = {
  allocations: [
    { productId: p1.id, product: p1, weight: 50, amount: 5000, rationale: '' },
    { productId: p2.id, product: p2, weight: 50, amount: 5000, rationale: '' },
  ],
  benchmark: { name: 'B', description: '', components: [], expectedReturn: 6, expectedVolatility: 12 },
} as unknown as Portfolio;

const config = { startDate: '2021-01-01', endDate: '2025-01-01', initialAmount: 10_000 };
const MONTHS = 48;

describe('backtest: classificació de dades reals vs simulades', () => {
  it('un històric complet compta com a real', () => {
    const full = Array.from({ length: MONTHS }, () => 0.5);
    const r = runBacktest(portfolio, config, new Map([[p1.id, full], [p2.id, full]]));
    expect(r.dataQuality.productsWithRealData).toBe(2);
    expect(r.dataQuality.productsSimulated).toBe(0);
    expect(r.dataQuality.source).toBe('real');
    expect(r.dataQuality.dataCompleteness).toBe(100);
  });

  it('un històric parcial (≥50% però incomplet) es marca com a simulat', () => {
    const full    = Array.from({ length: MONTHS }, () => 0.5);
    const partial = Array.from({ length: Math.ceil(MONTHS * 0.6) }, () => 0.5);
    const r = runBacktest(portfolio, config, new Map([[p1.id, full], [p2.id, partial]]));
    expect(r.dataQuality.productsWithRealData).toBe(1);
    expect(r.dataQuality.productsSimulated).toBe(1);
    expect(r.dataQuality.source).toBe('mixed');
    expect(r.dataQuality.dataCompleteness).toBe(50);
  });

  it('és determinista: el mateix input dona el mateix resultat', () => {
    const partial = Array.from({ length: 30 }, (_, i) => (i % 3) - 1);
    const data = new Map([[p1.id, partial], [p2.id, partial]]);
    const a = runBacktest(portfolio, config, data);
    const b = runBacktest(portfolio, config, data);
    expect(a.portfolioSeries).toEqual(b.portfolioSeries);
  });
});

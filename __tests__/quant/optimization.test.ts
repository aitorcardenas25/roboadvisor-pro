import { describe, it, expect } from 'vitest';
import {
  optimizePortfolio,
  identityCorrelationMatrix,
  computeCorrelationMatrix,
  type Asset,
} from '@/lib/optimization';

const ASSETS_2: Asset[] = [
  { id: 'bond',   expectedReturn: 3,  volatility: 5  },
  { id: 'equity', expectedReturn: 9,  volatility: 18 },
];

const ASSETS_4: Asset[] = [
  { id: 'bond',     expectedReturn: 3,  volatility: 5  },
  { id: 'equity',   expectedReturn: 9,  volatility: 18 },
  { id: 'em',       expectedReturn: 11, volatility: 25 },
  { id: 'realestate', expectedReturn: 7, volatility: 12 },
];

describe('identityCorrelationMatrix', () => {
  it('diagonal = 1, fora de diagonal = 0', () => {
    const m = identityCorrelationMatrix(3);
    expect(m.correlations[0][0]).toBe(1);
    expect(m.correlations[0][1]).toBe(0);
    expect(m.correlations[1][0]).toBe(0);
    expect(m.correlations[2][2]).toBe(1);
  });
});

describe('computeCorrelationMatrix', () => {
  it('sèrie idèntica → correlació = 1', () => {
    const s = [1, -1, 2, -2, 1, 3];
    const m = computeCorrelationMatrix([s, s]);
    expect(m.correlations[0][1]).toBeCloseTo(1, 4);
  });

  it('sèries oposades → correlació ≈ -1', () => {
    const s = [1, -1, 2, -2, 1, 3];
    const neg = s.map(x => -x);
    const m = computeCorrelationMatrix([s, neg]);
    expect(m.correlations[0][1]).toBeCloseTo(-1, 4);
  });

  it('diagonal sempre = 1', () => {
    const s1 = [1, 2, 3, 4, 5];
    const s2 = [5, 4, 3, 2, 1];
    const m = computeCorrelationMatrix([s1, s2]);
    expect(m.correlations[0][0]).toBe(1);
    expect(m.correlations[1][1]).toBe(1);
  });
});

describe('optimizePortfolio', () => {
  it('llança error amb < 2 actius', () => {
    expect(() =>
      optimizePortfolio([ASSETS_2[0]], identityCorrelationMatrix(1)),
    ).toThrow();
  });

  it('llança error si dimensions incompatibles', () => {
    expect(() =>
      optimizePortfolio(ASSETS_2, identityCorrelationMatrix(3)),
    ).toThrow();
  });

  it('pesos sumen a 1 (tangency portfolio)', () => {
    const matrix = identityCorrelationMatrix(2);
    const result = optimizePortfolio(ASSETS_2, matrix);
    const sum = result.tangencyPortfolio.weights.reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 3);
  });

  it('pesos sumen a 1 (min variance portfolio)', () => {
    const matrix = identityCorrelationMatrix(2);
    const result = optimizePortfolio(ASSETS_2, matrix);
    const sum = result.minVariancePortfolio.weights.reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 3);
  });

  it('long-only: tots els pesos ≥ 0', () => {
    const matrix = identityCorrelationMatrix(4);
    const result = optimizePortfolio(ASSETS_4, matrix);
    for (const w of result.tangencyPortfolio.weights) {
      expect(w).toBeGreaterThanOrEqual(-0.001); // tolerància numèrica
    }
  });

  it('min variance té volatilitat ≤ tangency', () => {
    const matrix = identityCorrelationMatrix(4);
    const result = optimizePortfolio(ASSETS_4, matrix);
    expect(result.minVariancePortfolio.volatility).toBeLessThanOrEqual(
      result.tangencyPortfolio.volatility + 0.5,
    );
  });

  it('tangency maximitza Sharpe (≥ min variance Sharpe)', () => {
    const matrix = identityCorrelationMatrix(4);
    const result = optimizePortfolio(ASSETS_4, matrix, { riskFreeRate: 3 });
    expect(result.tangencyPortfolio.sharpeRatio).toBeGreaterThanOrEqual(
      result.minVariancePortfolio.sharpeRatio - 0.01,
    );
  });

  it('frontier té 20 punts', () => {
    const matrix = identityCorrelationMatrix(2);
    const result = optimizePortfolio(ASSETS_2, matrix);
    expect(result.efficientFrontier).toHaveLength(20);
  });

  it('restricció maxWeight=0.6 → cap pes supera 0.61', () => {
    const matrix = identityCorrelationMatrix(4);
    const result = optimizePortfolio(ASSETS_4, matrix, { maxWeight: 0.6 });
    for (const w of result.tangencyPortfolio.weights) {
      expect(w).toBeLessThanOrEqual(0.61);
    }
  });

  it('retorn esperat dins del rang dels actius', () => {
    const matrix = identityCorrelationMatrix(4);
    const result = optimizePortfolio(ASSETS_4, matrix);
    const minRet = Math.min(...ASSETS_4.map(a => a.expectedReturn));
    const maxRet = Math.max(...ASSETS_4.map(a => a.expectedReturn));
    expect(result.tangencyPortfolio.expectedReturn).toBeGreaterThanOrEqual(minRet - 0.1);
    expect(result.tangencyPortfolio.expectedReturn).toBeLessThanOrEqual(maxRet + 0.1);
  });
});

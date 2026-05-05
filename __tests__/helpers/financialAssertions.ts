import { expect } from 'vitest';

// Comprova que un valor numèric és dins d'un rang [expected ± tolerancePct %]
export function expectNear(actual: number, expected: number, tolerancePct: number, label = '') {
  const lo = expected * (1 - tolerancePct / 100);
  const hi = expected * (1 + tolerancePct / 100);
  expect(actual, `${label}: ${actual} fora de [${lo.toFixed(2)}, ${hi.toFixed(2)}]`).toBeGreaterThanOrEqual(lo);
  expect(actual, `${label}: ${actual} fora de [${lo.toFixed(2)}, ${hi.toFixed(2)}]`).toBeLessThanOrEqual(hi);
}

// Solució analítica de la mediana de GBM (Ito's lemma)
// P50 ≈ S0 × exp((μ - σ²/2) × T)
export function gbmMedian(
  initial: number,
  annualReturn: number,   // % ex: 7
  annualVolatility: number, // % ex: 15
  years: number
): number {
  const mu    = annualReturn    / 100;
  const sigma = annualVolatility / 100;
  return initial * Math.exp((mu - (sigma * sigma) / 2) * years);
}

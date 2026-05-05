import { describe, it, expect } from 'vitest';
import { calculateHistoricalVaR, calculateParametricVaR } from '@/lib/metrics';

// Synthetic monthly returns: mix of positive and negative
const RETURNS_60 = Array.from({ length: 60 }, (_, i) => {
  // deterministic pattern: 1%, -0.5%, 2%, -1%, 0.5% repeating
  const cycle = [1, -0.5, 2, -1, 0.5];
  return cycle[i % 5];
});

// Returns with a known bad tail
const CRASH_RETURNS = [...RETURNS_60, -10, -12, -8, -15, -9];

describe('calculateHistoricalVaR', () => {
  it('VaR > 0 (pèrdua positiva) per a retorns amb cua negativa', () => {
    const result = calculateHistoricalVaR(CRASH_RETURNS);
    expect(result.var).toBeGreaterThan(0);
  });

  it('CVaR ≥ VaR (el CVaR captura la pitjor pèrdua esperada)', () => {
    const result = calculateHistoricalVaR(CRASH_RETURNS);
    expect(result.cvar).toBeGreaterThanOrEqual(result.var);
  });

  it('95% VaR > 90% VaR (més confiança → major VaR)', () => {
    const var95 = calculateHistoricalVaR(CRASH_RETURNS, 0.95);
    const var90 = calculateHistoricalVaR(CRASH_RETURNS, 0.90);
    expect(var95.var).toBeGreaterThanOrEqual(var90.var);
  });

  it('sèrie curta (<10) → retorna 0 sense error', () => {
    const result = calculateHistoricalVaR([1, -1, 2], 0.95);
    expect(result.var).toBe(0);
    expect(result.cvar).toBe(0);
  });

  it('method = "historical"', () => {
    expect(calculateHistoricalVaR(CRASH_RETURNS).method).toBe('historical');
  });
});

describe('calculateParametricVaR', () => {
  it('VaR > 0 per a cartera amb vol positiva', () => {
    const result = calculateParametricVaR(7, 15);
    expect(result.var).toBeGreaterThan(0);
  });

  it('CVaR ≥ VaR', () => {
    const result = calculateParametricVaR(7, 15);
    expect(result.cvar).toBeGreaterThanOrEqual(result.var);
  });

  it('vol = 0 → VaR ≈ rendibilitat mensual negada', () => {
    // Sense vol, la "pèrdua" és el retorn mensual esperat negatiu → però 7%/12 és positiu
    // VaR = -(monthlyReturn - z*0) = -monthlyReturn
    const result = calculateParametricVaR(7, 0.00001);
    // Retorn mensual = 7/12 ≈ 0.583%, VaR hauria de ser petit
    expect(Math.abs(result.var)).toBeLessThan(1);
  });

  it('més volatilitat → VaR més gran', () => {
    const low  = calculateParametricVaR(7, 5);
    const high = calculateParametricVaR(7, 30);
    expect(high.var).toBeGreaterThan(low.var);
  });

  it('method = "parametric"', () => {
    expect(calculateParametricVaR(7, 15).method).toBe('parametric');
  });
});

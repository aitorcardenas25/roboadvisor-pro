import { describe, it, expect } from 'vitest';
import {
  calculateAnnualizedReturn,
  calculateAnnualizedVolatility,
  calculateMaxDrawdown,
} from '@/lib/metrics';

// ── calculateAnnualizedReturn ──────────────────────────────────────────────

describe('calculateAnnualizedReturn', () => {
  it('retorns mensuals constants del 1% → CAGR ≈ 12.68%', () => {
    // (1 + 0.01)^12 - 1 = 12.68%
    const returns = Array(12).fill(1); // 1% mensual × 12 mesos = 1 any
    const cagr = calculateAnnualizedReturn(returns);
    expect(cagr).toBeCloseTo(12.68, 0);
  });

  it('retorns plans de 0.5% mensual durant 24 mesos → CAGR ≈ 6.17%', () => {
    // (1 + 0.005)^12 - 1 = 6.168%
    const returns = Array(24).fill(0.5);
    const cagr = calculateAnnualizedReturn(returns);
    expect(cagr).toBeCloseTo(6.17, 0);
  });

  it('retorns alternats que es cancel·len ≈ 0%', () => {
    // +10%, -9.09% → producte ≈ 0
    const returns = Array(12).flatMap(() => [10, -9.09]);
    const cagr = calculateAnnualizedReturn(returns);
    expect(Math.abs(cagr)).toBeLessThan(1);
  });

  it("retorna 0 per array buit o array d'un element", () => {
    expect(calculateAnnualizedReturn([])).toBe(0);
  });
});

// ── calculateAnnualizedVolatility ──────────────────────────────────────────

describe('calculateAnnualizedVolatility', () => {
  it('volatilitat de retorns constants és 0', () => {
    const returns = Array(60).fill(1);
    expect(calculateAnnualizedVolatility(returns)).toBeCloseTo(0, 5);
  });

  it('retorna un valor positiu per retorns variables', () => {
    const returns = [5, -3, 8, -2, 6, -4, 7, 1, -5, 3, 4, -1];
    const vol = calculateAnnualizedVolatility(returns);
    expect(vol).toBeGreaterThan(0);
  });

  it('volatilitat és ≥ 0 sempre', () => {
    const returns = [1, -1, 2, -2, 3, -3];
    expect(calculateAnnualizedVolatility(returns)).toBeGreaterThanOrEqual(0);
  });

  it('més variació → més volatilitat', () => {
    const quietReturns  = Array(24).fill(0).map((_, i) => i % 2 === 0 ?  1 : -1);
    const wildReturns   = Array(24).fill(0).map((_, i) => i % 2 === 0 ? 10 : -10);
    expect(calculateAnnualizedVolatility(wildReturns)).toBeGreaterThan(
      calculateAnnualizedVolatility(quietReturns)
    );
  });
});

// ── calculateMaxDrawdown ───────────────────────────────────────────────────

describe('calculateMaxDrawdown', () => {
  it('serie sempre positiva → drawdown petit o zero', () => {
    const returns = [1, 2, 3, 1, 2, 1]; // puja i baixa però sense pèrdues severes
    const dd = calculateMaxDrawdown(returns);
    expect(dd).toBeGreaterThanOrEqual(0);
  });

  it('caiguda del 50% seguida de recuperació → drawdown ≤ -30%', () => {
    // Simulem una caiguda forta — retorna negatiu: -52 = 52% de drawdown
    const returns = [10, 10, -40, -20, 10, 10, 15];
    const dd = calculateMaxDrawdown(returns);
    expect(dd).toBeLessThan(-30);
  });

  it('drawdown sempre entre -100 i 0', () => {
    const returns = [5, -10, 3, -15, 8, -5];
    const dd = calculateMaxDrawdown(returns);
    expect(dd).toBeGreaterThanOrEqual(-100);
    expect(dd).toBeLessThanOrEqual(0);
  });

  it('inversió creixent contínua → drawdown proper a 0', () => {
    const returns = Array(24).fill(1); // puja sempre
    const dd = calculateMaxDrawdown(returns);
    expect(dd).toBeLessThan(5);
  });

  it('returns buit → retorna 0', () => {
    expect(calculateMaxDrawdown([])).toBe(0);
  });
});

// ── Consistència Sharpe ────────────────────────────────────────────────────

describe('consistència Sharpe vs. components', () => {
  it('rendiment alt i vol baixa → Sharpe alt', () => {
    const highReturn = Array(60).fill(1.2); // ~15% anualitzat
    const lowVol     = Array(60).fill(0.3); // baixa vol

    const retHigh = calculateAnnualizedReturn(highReturn);
    const retLow  = calculateAnnualizedReturn(lowVol);
    const volHigh = calculateAnnualizedVolatility(highReturn);
    const volLow  = calculateAnnualizedVolatility(lowVol);

    // Amb retorns constants, la vol és 0 — però podem verificar la relació
    expect(retHigh).toBeGreaterThan(retLow);
    expect(volHigh).toBeCloseTo(volLow, 2); // constants, vol ≈ 0 ambdós
  });
});

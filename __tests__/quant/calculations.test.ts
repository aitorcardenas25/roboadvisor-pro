import { describe, it, expect } from 'vitest';
import {
  futureValue,
  calculateCAGR,
  totalReturn,
  realReturn,
  inflationAdjustedValue,
  weightedTER,
  sharpeRatio,
  herfindahlIndex,
  effectiveN,
} from '@/utils/calculations';

// ── futureValue ────────────────────────────────────────────────────────────

describe('futureValue', () => {
  it('10.000€ al 7% durant 10 anys ≈ 20.097€ (capitalització mensual)', () => {
    // FV = 10000 × (1 + 0.07/12)^120 = 20.096,61 (mensual, no anual)
    const fv = futureValue(10_000, 7, 10, 0);
    expect(fv).toBeCloseTo(20_097, -2);
  });

  it('sense inversió inicial, 500€/mes al 6% durant 10 anys', () => {
    // FV annuity = 500 × [(1 + 0.005)^120 - 1] / 0.005 ≈ 81.940€
    const fv = futureValue(0, 6, 10, 500);
    expect(fv).toBeGreaterThan(70_000);
    expect(fv).toBeLessThan(95_000);
  });

  it('rendiment 0% → suma de capital + aportacions', () => {
    const fv = futureValue(10_000, 0, 10, 100);
    expect(fv).toBeCloseTo(10_000 + 100 * 12 * 10, 0);
  });

  it('resultat sempre ≥ inversió inicial (rendiment ≥ 0)', () => {
    expect(futureValue(5_000, 5, 20, 200)).toBeGreaterThanOrEqual(5_000);
  });
});

// ── calculateCAGR ──────────────────────────────────────────────────────────

describe('calculateCAGR', () => {
  it('10.000 → 20.000 en 10 anys → CAGR ≈ 7.18%', () => {
    // (20000/10000)^(1/10) - 1 = 7.177%
    const cagr = calculateCAGR(10_000, 20_000, 10);
    expect(cagr).toBeCloseTo(7.18, 0);
  });

  it('valor inicial = final → CAGR = 0', () => {
    const cagr = calculateCAGR(10_000, 10_000, 5);
    expect(cagr).toBeCloseTo(0, 4);
  });

  it('pèrdua → CAGR negatiu', () => {
    const cagr = calculateCAGR(10_000, 8_000, 5);
    expect(cagr).toBeLessThan(0);
  });
});

// ── totalReturn ────────────────────────────────────────────────────────────

describe('totalReturn', () => {
  it('10.000 → 15.000 → retorn total del 50%', () => {
    expect(totalReturn(10_000, 15_000)).toBeCloseTo(50, 2);
  });

  it('pèrdua del 20%', () => {
    expect(totalReturn(10_000, 8_000)).toBeCloseTo(-20, 2);
  });

  it('sense variació → retorn 0', () => {
    expect(totalReturn(5_000, 5_000)).toBeCloseTo(0, 4);
  });
});

// ── realReturn (Fisher equation) ───────────────────────────────────────────

describe('realReturn', () => {
  it('7% nominal, 2.5% inflació → retorn real ≈ 4.39%', () => {
    // Fisher: (1 + 0.07) / (1 + 0.025) - 1 = 4.39%
    const rr = realReturn(7, 2.5);
    expect(rr).toBeCloseTo(4.39, 0);
  });

  it('nominal = inflació → retorn real ≈ 0%', () => {
    const rr = realReturn(3, 3);
    expect(Math.abs(rr)).toBeLessThan(0.1);
  });

  it('inflació > nominal → retorn real negatiu', () => {
    expect(realReturn(2, 5)).toBeLessThan(0);
  });
});

// ── inflationAdjustedValue ─────────────────────────────────────────────────

describe('inflationAdjustedValue', () => {
  it('100.000€ en 10 anys amb 2.5% inflació → poder adquisitiu menor', () => {
    const adjusted = inflationAdjustedValue(100_000, 2.5, 10);
    expect(adjusted).toBeLessThan(100_000);
    // 100000 / (1.025)^10 ≈ 78.120€
    expect(adjusted).toBeCloseTo(78_120, -3);
  });

  it('inflació 0% → valor no canvia', () => {
    const adjusted = inflationAdjustedValue(50_000, 0, 5);
    expect(adjusted).toBeCloseTo(50_000, 0);
  });
});

// ── weightedTER ────────────────────────────────────────────────────────────

describe('weightedTER', () => {
  it('cartera 50/50 amb TERs 0.20% i 0.80% → TER mig 0.50%', () => {
    const ter = weightedTER(
      [{ weight: 50, ter: 0.20 }, { weight: 50, ter: 0.80 }]
    );
    expect(ter).toBeCloseTo(0.50, 4);
  });

  it('un sol actiu → TER és el seu propi', () => {
    const ter = weightedTER([{ weight: 100, ter: 0.35 }]);
    expect(ter).toBeCloseTo(0.35, 4);
  });
});

// ── sharpeRatio ────────────────────────────────────────────────────────────

describe('sharpeRatio', () => {
  it('7% retorn, 3% risk-free, 15% vol → Sharpe ≈ 0.267', () => {
    // (7 - 3) / 15 = 0.2667
    expect(sharpeRatio(7, 3, 15)).toBeCloseTo(0.267, 2);
  });

  it('retorn = risk-free → Sharpe = 0', () => {
    expect(sharpeRatio(3, 3, 10)).toBeCloseTo(0, 4);
  });

  it('retorn < risk-free → Sharpe negatiu', () => {
    expect(sharpeRatio(2, 3, 10)).toBeLessThan(0);
  });

  it('vol ≈ 0 → no retorna NaN ni Infinity', () => {
    const result = sharpeRatio(7, 3, 0.0001);
    expect(isFinite(result)).toBe(true);
  });
});

// ── herfindahlIndex & effectiveN (diversificació) ─────────────────────────

describe('herfindahlIndex i effectiveN', () => {
  it('cartera concentrada en 1 actiu → HHI = 1, effectiveN = 1', () => {
    expect(herfindahlIndex([100])).toBeCloseTo(1, 4);
    expect(effectiveN([100])).toBeCloseTo(1, 1);
  });

  it('cartera equi-ponderada de 4 actius → HHI = 0.25, effectiveN ≈ 4', () => {
    const weights = [25, 25, 25, 25];
    expect(herfindahlIndex(weights)).toBeCloseTo(0.25, 4);
    expect(effectiveN(weights)).toBeCloseTo(4, 0);
  });

  it('més concentrada → HHI més alt', () => {
    const concentrada = [80, 10, 5, 5];
    const diversificada = [40, 30, 20, 10];
    expect(herfindahlIndex(concentrada)).toBeGreaterThan(herfindahlIndex(diversificada));
  });
});

import { describe, it, expect } from 'vitest';
import { simulateSavings, requiredMonthly } from '@/lib/savingsSimulator';

describe('simulateSavings (valor futur d\'una anualitat)', () => {
  it('amb rendiment 0 i inflació 0, el valor és el que s\'ha aportat', () => {
    const r = simulateSavings({ initial: 1000, monthly: 100, years: 10, annualReturnPct: 0, inflationPct: 0 })!;
    expect(r.contributed).toBe(13000);
    expect(r.nominal).toBe(13000);
    expect(r.real).toBe(13000);
    expect(r.gain).toBe(0);
    expect(r.rows).toHaveLength(10);
  });

  it('un capital inicial sense aportacions creix com (1+r)^anys', () => {
    const r = simulateSavings({ initial: 10000, monthly: 0, years: 10, annualReturnPct: 4, inflationPct: 0 })!;
    expect(r.nominal).toBeCloseTo(10000 * Math.pow(1.04, 10), 1);
  });

  it('coincideix amb la fórmula tancada de l\'anualitat', () => {
    const i = Math.pow(1.06, 1 / 12) - 1;
    const n = 20 * 12;
    const expected = 500 * (Math.pow(1 + i, n) - 1) / i;
    const r = simulateSavings({ initial: 0, monthly: 500, years: 20, annualReturnPct: 6, inflationPct: 0 })!;
    expect(r.nominal).toBeCloseTo(expected, 1);
  });

  it('el valor real descompta la inflació', () => {
    const r = simulateSavings({ initial: 10000, monthly: 0, years: 5, annualReturnPct: 2, inflationPct: 2 })!;
    expect(r.real).toBeCloseTo(10000, 0);
  });

  it('rebutja entrades no vàlides', () => {
    expect(simulateSavings({ initial: -1, monthly: 0, years: 5, annualReturnPct: 2 })).toBeNull();
    expect(simulateSavings({ initial: 0, monthly: 0, years: 0, annualReturnPct: 2 })).toBeNull();
    expect(simulateSavings({ initial: 0, monthly: 0, years: 2.5, annualReturnPct: 2 })).toBeNull();
    expect(simulateSavings({ initial: 0, monthly: NaN, years: 5, annualReturnPct: 2 })).toBeNull();
  });
});

describe('requiredMonthly', () => {
  it('és la inversa de simulateSavings', () => {
    const m = requiredMonthly(30000, 60, 2000, 4)!;
    const r = simulateSavings({ initial: 2000, monthly: m, years: 5, annualReturnPct: 4, inflationPct: 0 })!;
    expect(r.nominal).toBeCloseTo(30000, 0);
  });
  it('sense rendiment és una divisió', () => {
    expect(requiredMonthly(12000, 12, 0, 0)).toBe(1000);
  });
  it('0 si ja s\'hi arriba amb el que es té', () => {
    expect(requiredMonthly(5000, 12, 6000, 0)).toBe(0);
  });
});

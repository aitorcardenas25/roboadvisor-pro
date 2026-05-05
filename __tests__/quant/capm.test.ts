import { describe, it, expect } from 'vitest';
import {
  capmExpectedReturn,
  estimateBeta,
  jensensAlpha,
  treynorRatio,
  DAMODARAN_ERP_EUR,
} from '@/lib/capm';

describe('capmExpectedReturn', () => {
  it('CAPM bàsic: Rf=3%, β=1, ERP=5.3% → E(R)=8.3%', () => {
    const result = capmExpectedReturn({ riskFreeRate: 3, beta: 1 });
    expect(result.expectedReturn).toBeCloseTo(3 + DAMODARAN_ERP_EUR, 4);
  });

  it('β=0 → E(R) = Rf (actiu sense risc sistemàtic)', () => {
    const result = capmExpectedReturn({ riskFreeRate: 3, beta: 0 });
    expect(result.expectedReturn).toBeCloseTo(3, 4);
  });

  it('β=2 → excés doble de la prima de mercat', () => {
    const result = capmExpectedReturn({ riskFreeRate: 2, beta: 2, marketReturnPremium: 5 });
    expect(result.expectedReturn).toBeCloseTo(2 + 2 * 5, 4);
    expect(result.excessReturn).toBeCloseTo(2 * 5, 4);
  });

  it('β negatiu → E(R) < Rf (actiu de cobertura)', () => {
    const result = capmExpectedReturn({ riskFreeRate: 3, beta: -0.3, marketReturnPremium: 5 });
    expect(result.expectedReturn).toBeLessThan(3);
  });
});

describe('estimateBeta', () => {
  it('array buit → NaN', () => {
    expect(isNaN(estimateBeta([], []))).toBe(true);
  });

  it('un sol punt → NaN', () => {
    expect(isNaN(estimateBeta([{ returnPct: 1 }], [{ returnPct: 1 }]))).toBe(true);
  });

  it('retorns idèntics → β ≈ 1', () => {
    const returns = [1, -2, 3, -1, 2].map(r => ({ returnPct: r }));
    const beta = estimateBeta(returns, returns);
    expect(beta).toBeCloseTo(1, 3);
  });

  it('actiu sense correlació amb el mercat → β ≈ 0', () => {
    const asset  = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1].map(r => ({ returnPct: r }));
    const market = [1, -1, 1, -1, 1, -1, 1, -1, 1, -1].map(r => ({ returnPct: r }));
    const beta = estimateBeta(asset, market);
    expect(Math.abs(beta)).toBeLessThan(0.1);
  });

  it('actiu amb volatilitat doble del mercat → β ≈ 2', () => {
    const market = [1, -1, 2, -2, 1.5, -1.5, 1, -1, 2, -2].map(r => ({ returnPct: r }));
    const asset  = market.map(m => ({ returnPct: m.returnPct * 2 }));
    const beta = estimateBeta(asset, market);
    expect(beta).toBeCloseTo(2, 1);
  });
});

describe('jensensAlpha', () => {
  it('actual = CAPM → alpha = 0', () => {
    const capm = capmExpectedReturn({ riskFreeRate: 3, beta: 1, marketReturnPremium: 5 });
    expect(jensensAlpha(capm.expectedReturn, capm)).toBeCloseTo(0, 4);
  });

  it('outperformance → alpha positiu', () => {
    const capm = capmExpectedReturn({ riskFreeRate: 3, beta: 1, marketReturnPremium: 5 });
    expect(jensensAlpha(capm.expectedReturn + 2, capm)).toBeCloseTo(2, 4);
  });
});

describe('treynorRatio', () => {
  it('beta = 0 → retorna 0 (no risc sistemàtic mesurable)', () => {
    expect(treynorRatio(8, 3, 0)).toBe(0);
  });

  it('ratio positiu quan retorn > risk-free', () => {
    expect(treynorRatio(8, 3, 1)).toBeGreaterThan(0);
  });

  it('ratio negatiu quan retorn < risk-free', () => {
    expect(treynorRatio(2, 3, 1)).toBeLessThan(0);
  });
});

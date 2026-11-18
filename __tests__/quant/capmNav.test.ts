import { describe, it, expect } from 'vitest';
import { capmReturn, estimateNavBeta, monthlyReturnsByMonth, CAPM_ASSUMPTIONS, validMarketSeries } from '@/lib/navMath';
import { proposalStats, expectedReturn, type ProposalItem } from '@/lib/proposalMath';

// Sèrie mensual (últim dia de mes) a partir d'una llista de rendiments mensuals (%)
function series(returns: number[], start = 2021): { date: string; nav: number }[] {
  const out = [{ date: `${start}-01-31`, nav: 100 }];
  returns.forEach((r, i) => {
    const y = start + Math.floor((i + 1) / 12), m = ((i + 1) % 12) + 1;
    out.push({ date: `${y}-${String(m).padStart(2, '0')}-28`, nav: out[out.length - 1].nav * (1 + r / 100) });
  });
  return out;
}
const market = Array.from({ length: 48 }, (_, i) => Math.sin(i) * 4 + 0.5);

describe('CAPM (Sharpe, 1964) amb beta dels valors liquidatius', () => {
  it('E(R) = Rf + β × prima', () => {
    expect(capmReturn(1)).toBeCloseTo(CAPM_ASSUMPTIONS.riskFree + CAPM_ASSUMPTIONS.equityPremium, 10);
    expect(capmReturn(0)).toBe(CAPM_ASSUMPTIONS.riskFree);
    expect(capmReturn(0.5, { riskFree: 2, equityPremium: 4 })).toBe(4);
  });

  it('rendiments mensuals: salta els mesos que falten', () => {
    const r = monthlyReturnsByMonth([{ date: '2025-01-31', nav: 100 }, { date: '2025-02-28', nav: 110 }, { date: '2025-04-30', nav: 121 }]);
    expect([...r.keys()]).toEqual(['2025-02']);
    expect(r.get('2025-02')).toBeCloseTo(10, 10);
  });

  it('beta: 1 amb el mateix índex, 2 amb el doble de moviment, ~0 sense relació', () => {
    const m = series(market);
    expect(estimateNavBeta(m, m)).toBe(1);
    expect(estimateNavBeta(series(market.map(r => r * 2)), m)).toBe(2);
    expect(Math.abs(estimateNavBeta(series(market.map((_, i) => (i % 2 ? 0.3 : 0.2))), m)!)).toBeLessThan(0.05);
  });

  it('beta: null amb menys de 24 mesos comuns', () => {
    expect(estimateNavBeta(series(market.slice(0, 12)), series(market))).toBeNull();
  });

  it('la proposta projecta amb el CAPM i no amb la rendibilitat històrica', () => {
    // Regressió (prova 2026-11-18): l'escenari central donava un 10,6 % anual (últims 5 anys).
    const item: ProposalItem = {
      isin: 'LU0996182563', name: 'MSCI World', category: 'RV Global', weight: 100, risk: 6, ter: 0.2, platform: '', justification: '',
      historicalReturn5Y: 10.6, historicalVolatility: 14, performanceSource: 'VL oficials', beta: 1,
    };
    expect(expectedReturn(item)).toBeCloseTo(capmReturn(1), 10);
    const s = proposalStats({ items: [item], horizon: 10, initialAmount: 10000, monthlyAmount: 0 });
    expect(s.returnBasis).toBe('capm');
    expect(s.grossReturn).toBeCloseTo(capmReturn(1), 10);
    expect(s.historicReturn).toBe(10.6);
    expect(s.netReturn).toBeCloseTo(capmReturn(1) - 0.2, 10);
    // sense beta: es fa servir l'històric
    expect(proposalStats({ items: [{ ...item, beta: undefined }], horizon: 10, initialAmount: 10000, monthlyAmount: 0 }).returnBasis).toBe('historic');
  });
});

// Regressió (revisió PR #44): un VL mal teclejat al proxy de mercat feia la beta ~0 a tots els fons.
describe('validació del proxy de mercat', () => {
  it('accepta una sèrie neta i rebutja una amb un VL multiplicat per 10', () => {
    const ok = series(Array.from({ length: 70 }, (_, i) => Math.sin(i) * 3 + 0.6), 2020);
    expect(validMarketSeries(ok)).toBe(ok);
    const bad = ok.map((p, i) => (i === 30 ? { ...p, nav: p.nav * 10 } : p));
    expect(validMarketSeries(bad)).toEqual([]);
  });
});

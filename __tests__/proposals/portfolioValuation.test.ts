import { describe, it, expect } from 'vitest';
import { planApplication, valuationSeries, monthEnds, navOnOrBefore, navsByIsin, aggregatePeriods, MAX_PRICE_AGE_DAYS } from '@/lib/portfolioValuation';
import type { NavPoint } from '@/lib/navMath';

const nav = (isin: string, date: string, v: number): NavPoint => ({ isin, date, nav: v, currency: 'EUR' });
const A = 'IE00B03HD191', B = 'ES0114673033';
const navs: NavPoint[] = [
  nav(A, '2026-08-31', 40), nav(A, '2026-09-30', 42), nav(A, '2026-10-30', 44),
  nav(B, '2026-08-31', 100), nav(B, '2026-09-30', 95), nav(B, '2026-10-31', 110),
];

describe('planApplication', () => {
  it('compra cada fons al seu VL oficial fins a la data, segons el pes', () => {
    const plan = planApplication(
      [{ isin: A, name: 'Global', category: 'RV', weight: 60 }, { isin: B, name: 'Bestinfond', category: 'RV', weight: 40 }],
      10_000, '2026-09-30', navs,
    );
    expect(plan.problems).toEqual([]);
    expect(plan.lines.map(l => [l.isin, l.amount, l.nav, l.quantity])).toEqual([
      [A, 6000, 42, 142.857143],
      [B, 4000, 95, 42.105263],
    ]);
  });

  it('no compra res si a algun fons li falta el preu o és massa antic', () => {
    const noPrice = planApplication([{ isin: 'LU0000000000', name: 'X', category: '', weight: 100 }], 1000, '2026-10-31', navs);
    expect(noPrice.lines).toEqual([]);
    expect(noPrice.problems[0]).toMatch(/no hi ha cap valor liquidatiu/);

    const stale = planApplication([{ isin: A, name: 'Global', category: '', weight: 100 }], 1000, '2027-01-31', navs);
    expect(stale.lines).toEqual([]);
    expect(stale.problems[0]).toMatch(new RegExp(`dies abans`));
    expect(MAX_PRICE_AGE_DAYS).toBe(45);
  });

  it('rebutja pesos que no sumen 100 i imports buits', () => {
    expect(planApplication([{ isin: A, name: 'G', category: '', weight: 50 }], 1000, '2026-09-30', navs).problems[0]).toMatch(/sumen 50/);
    expect(planApplication([{ isin: A, name: 'G', category: '', weight: 100 }], 0, '2026-09-30', navs).problems[0]).toMatch(/més gran que 0/);
  });
});

describe('valuationSeries', () => {
  const holdings = [
    { id: 'h1', assetIsin: A, assetName: 'Global', quantity: 100, avgEntryPrice: 40, createdAt: '2026-08-31T10:00:00Z' },
    { id: 'h2', assetIsin: B, assetName: 'Bestinfond', quantity: 10, avgEntryPrice: 100, createdAt: '2026-08-31T10:00:00Z' },
  ];
  const txs = [
    { holdingId: 'h1', operationType: 'buy', date: '2026-08-31', quantity: 100, totalEur: 4000, commission: 0 },
    { holdingId: 'h2', operationType: 'buy', date: '2026-08-31', quantity: 10, totalEur: 1000, commission: 0 },
  ];

  it('valora cada final de mes amb participacions × VL oficial', () => {
    const v = valuationSeries(holdings, txs, navs, '2026-11-17');
    expect(v.missing).toEqual([]);
    expect(v.points).toEqual([
      { date: '2026-08-31', value: 5000, invested: 5000 },
      { date: '2026-09-30', value: 5150, invested: 5000 },
      { date: '2026-10-30', value: 5350, invested: 5000 },   // fins a l'últim preu del fons més endarrerit (Bestinfond encara a 95)
    ]);
  });

  it('té en compte compres posteriors', () => {
    const more = [...txs, { holdingId: 'h1', operationType: 'buy', date: '2026-09-30', quantity: 50, totalEur: 2100, commission: 0 }];
    const v = valuationSeries([{ ...holdings[0], quantity: 150 }, holdings[1]], more, navs, '2026-11-17');
    expect(v.points[0]).toEqual({ date: '2026-08-31', value: 5000, invested: 5000 });
    expect(v.points[1]).toEqual({ date: '2026-09-30', value: 150 * 42 + 950, invested: 7100 });
  });

  it('sense preus d\'un fons no inventa res', () => {
    const v = valuationSeries([...holdings, { id: 'h3', assetIsin: 'LU0000000000', assetName: 'Sense preus', quantity: 1, avgEntryPrice: 1, createdAt: '2026-08-31' }], txs, navs);
    expect(v.points).toEqual([]);
    expect(v.missing).toEqual(['Sense preus']);
  });

  it('posició sense operacions: es valora des de la data de creació', () => {
    const v = valuationSeries([holdings[0]], [], navs, '2026-11-17');
    expect(v.points.map(p => p.value)).toEqual([4000, 4200, 4400]);
    expect(v.points[0].invested).toBe(4000);
  });
});

describe('utilitats', () => {
  it('monthEnds i navOnOrBefore', () => {
    expect(monthEnds('2026-01-15', '2026-03-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    const list = navsByIsin(navs).get(A);
    expect(navOnOrBefore(list, '2026-09-15')?.date).toBe('2026-08-31');
    expect(navOnOrBefore(list, '2026-08-01')).toBeNull();
  });
});

describe('aggregatePeriods', () => {
  const pts = [
    { date: '2026-01-15', value: 1000, invested: 1000 },
    { date: '2026-01-31', value: 1010, invested: 1000 },
    { date: '2026-02-28', value: 1530, invested: 1500 },   // +500 aportats
    { date: '2026-03-31', value: 1500, invested: 1500 },
    { date: '2026-04-30', value: 1560, invested: 1500 },
    { date: '2026-05-12', value: 1580, invested: 1500 },   // període en curs
  ];

  it('mensual: rendiment de cada mes descomptant les aportacions (Modified Dietz)', () => {
    const r = aggregatePeriods(pts, 'month');
    expect(r.map(x => x.date)).toEqual(pts.map(p => p.date));
    expect(r[0]).toMatchObject({ flow: 1000, gain: 0, periodReturn: null, totalReturn: 0 });
    expect(r[1]).toMatchObject({ flow: 0, gain: 10, periodReturn: 1 });
    // feb: (1530 − 1010 − 500) / (1010 + 250) = 1,59 %
    expect(r[2]).toMatchObject({ flow: 500, gain: 20, periodReturn: 1.59, totalReturn: 2 });
  });

  it('trimestral i anual: només finals de període, la primera data i l\'última', () => {
    expect(aggregatePeriods(pts, 'quarter').map(x => x.date)).toEqual(['2026-01-15', '2026-03-31', '2026-05-12']);
    const q = aggregatePeriods(pts, 'quarter');
    expect(q[1]).toMatchObject({ flow: 500, gain: 0, periodReturn: 0 });
    expect(aggregatePeriods(pts, 'year').map(x => x.date)).toEqual(['2026-01-15', '2026-05-12']);
    expect(aggregatePeriods([], 'month')).toEqual([]);
  });
});

describe('valuationSeries (revisió)', () => {
  const A2 = 'IE00B03HD191', B2 = 'ES0114673033';
  const navs2: NavPoint[] = [
    nav(A2, '2026-08-31', 40), nav(A2, '2026-09-30', 42), nav(A2, '2026-10-30', 44),
    nav(B2, '2026-08-31', 100), nav(B2, '2026-09-30', 95), nav(B2, '2026-10-31', 110),
  ];

  it('una posició venuda del tot continua comptant en les dates en què es tenia', () => {
    const holdings = [
      { id: 'h1', assetIsin: A2, assetName: 'Global', quantity: 100, avgEntryPrice: 40, createdAt: '2026-08-31' },
      { id: 'h2', assetIsin: B2, assetName: 'Bestinfond', quantity: 0, avgEntryPrice: 100, createdAt: '2026-08-31' },
    ];
    const txs = [
      { holdingId: 'h1', operationType: 'buy', date: '2026-08-31', quantity: 100, totalEur: 4000, commission: 0 },
      { holdingId: 'h2', operationType: 'buy', date: '2026-08-31', quantity: 10, totalEur: 1000, commission: 0 },
      { holdingId: 'h2', operationType: 'sell', date: '2026-09-30', quantity: 10, totalEur: 950, commission: 0 },
    ];
    const v = valuationSeries(holdings, txs, navs2, '2026-11-17');
    expect(v.points).toEqual([
      { date: '2026-08-31', value: 5000, invested: 5000 },
      { date: '2026-09-30', value: 4200, invested: 4050 },
      { date: '2026-10-30', value: 4400, invested: 4050 },
    ]);
  });

  it('preus en una altra moneda: no es barregen amb euros', () => {
    const v = valuationSeries(
      [{ id: 'h1', assetIsin: A2, assetName: 'Global USD', quantity: 1, avgEntryPrice: 40, createdAt: '2026-08-31' }], [],
      navs2.map(n => ({ ...n, currency: 'USD' })), '2026-11-17');
    expect(v.points).toEqual([]);
    expect(v.missing).toEqual(['Global USD (preus en USD)']);
  });
});

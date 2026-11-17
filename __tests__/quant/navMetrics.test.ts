// Preus dels fons entrats a mà: lectura del text enganxat i mètriques.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseNavText, parseNavDate, parseNavNumber, computeNavMetrics, navPerformance, monthEndSeries,
  MIN_YEARS_FOR_PROPOSALS,
} from '@/lib/navMath';
import { getNavPerformanceMap, getNavSummary, upsertNavs, deleteNavs, getNavs, currencyConflicts, __resetNavsForTests } from '@/lib/fundNavs';
import { verifiedPerformance, fundToItem, hasPerformanceData } from '@/lib/proposalMath';
import { createClientPortfolio, addHolding, getAllClientPortfolios, syncHoldingsToNavs, reconcileHoldingsAfterNavDelete } from '@/lib/clientPortfolios';

const ISIN = 'LU0996182563';   // Amundi MSCI World (llista de l'assessor)

/** Sèrie mensual (últim dia de mes) que creix un `g` mensual constant. */
function series(months: number, g: number, start = '2021-10', base = 100): { date: string; nav: number }[] {
  const [y0, m0] = start.split('-').map(Number);
  return Array.from({ length: months + 1 }, (_, i) => {
    const t = y0 * 12 + (m0 - 1) + i;
    const y = Math.floor(t / 12), m = (t % 12) + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { date: `${y}-${String(m).padStart(2, '0')}-${last}`, nav: base * Math.pow(1 + g, i) };
  });
}

describe('parseNavDate / parseNavNumber', () => {
  it('entén els formats habituals', () => {
    expect(parseNavDate('31/10/2026')).toBe('2026-10-31');
    expect(parseNavDate('1.2.2025')).toBe('2025-02-01');
    expect(parseNavDate('2026-10-31')).toBe('2026-10-31');
    expect(parseNavDate('31/02/2026')).toBeNull();
    expect(parseNavNumber('123,4567')).toBeCloseTo(123.4567);
    expect(parseNavNumber('1.234,56')).toBeCloseTo(1234.56);
    expect(parseNavNumber('1,234.56')).toBeCloseTo(1234.56);
    expect(parseNavNumber('12.5')).toBeCloseTo(12.5);
    expect(parseNavNumber('abc')).toBeNull();
  });
});

describe('parseNavText', () => {
  it('llegeix files enganxades d\'Excel amb capçalera', () => {
    const r = parseNavText(`ISIN\tData\tValor liquidatiu\tMoneda\n${ISIN}\t31/10/2026\t412,35\tEUR\n${ISIN}\t30/09/2026\t405,10\tEUR`);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { isin: ISIN, date: '2026-10-31', nav: 412.35, currency: 'EUR' },
      { isin: ISIN, date: '2026-09-30', nav: 405.10, currency: 'EUR' },
    ]);
  });

  it('en descàrregues tipus Yahoo/EODHD (Open,High,Low,Close…) llegeix el tancament ajustat, no l\'obertura', () => {
    const csv = 'Date,Open,High,Low,Close,Adjusted_close,Volume\n2026-11-12,130.8,131.86,130.24,131.63,131.63,387988\n2026-11-13,130.905,131.755,129.85,130.44,130.44,323081';
    const r = parseNavText(csv, { defaultIsin: ISIN });
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { isin: ISIN, date: '2026-11-12', nav: 131.63, currency: 'EUR' },
      { isin: ISIN, date: '2026-11-13', nav: 130.44, currency: 'EUR' },
    ]);
    const y = parseNavText('Date,Open,High,Low,Close,Adj Close,Volume\n2026-11-13,10,11,9,10.5,10.2,100', { defaultIsin: ISIN });
    expect(y.rows[0].nav).toBe(10.2);
  });

  it('no fa servir números sobrants com a nom del fons', () => {
    expect(parseNavText(`${ISIN};2026-10-31;412,35;413,00`).rows[0].name).toBeUndefined();
  });

  it('accepta punt i coma, coma i espais, i ISIN per defecte', () => {
    expect(parseNavText(`${ISIN};2026-10-31;412,35`).rows[0].nav).toBeCloseTo(412.35);
    expect(parseNavText(`${ISIN},2026-10-31,412.35`).rows[0].nav).toBeCloseTo(412.35);
    const r = parseNavText('31/10/2026 412,35\n30/09/2026 405,10', { defaultIsin: ISIN, defaultCurrency: 'usd' });
    expect(r.rows.map(x => [x.isin, x.currency])).toEqual([[ISIN, 'USD'], [ISIN, 'USD']]);
  });

  it('rebutja dades dolentes amb el número de línia', () => {
    const r = parseNavText(`31/10/2026\t10\nLU0996182564\t31/10/2026\t10\n${ISIN}\t31/10/2026\t0\n${ISIN}\tahir\t10\n${ISIN}\t01/01/2999\t10`);
    expect(r.rows).toEqual([]);
    expect(r.errors.map(e => e.line)).toEqual([1, 2, 3, 4, 5]);
    expect(r.errors[0].message).toMatch(/ISIN/);
    expect(r.errors[1].message).toMatch(/no vàlid/);
    expect(r.errors[4].message).toMatch(/futura/);
  });

  it('una data repetida es queda l\'última i avisa', () => {
    const r = parseNavText(`${ISIN}\t31/10/2026\t10\n${ISIN}\t31/10/2026\t11`);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].nav).toBe(11);
    expect(r.warnings).toHaveLength(1);
  });

  it('no barreja monedes dins un mateix fons', () => {
    const r = parseNavText(`${ISIN}\t31/10/2026\t10\tEUR\n${ISIN}\t30/09/2026\t10\tUSD`);
    expect(r.errors.some(e => /monedes diferents/.test(e.message))).toBe(true);
  });

  it('ignora les files de la plantilla sense omplir', () => {
    const r = parseNavText(`ISIN;Nom;Data;Valor liquidatiu;Moneda\n${ISIN};Amundi Index MSCI World;;;EUR`);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });
});

describe('computeNavMetrics', () => {
  const asOf = new Date('2026-11-10T00:00:00Z');

  it('rendibilitat anual (CAGR) i volatilitat zero amb creixement constant', () => {
    const m = computeNavMetrics(series(60, 0.005), asOf);   // 5 anys a +0,5 % mensual
    expect(m.months).toBe(60);
    expect(m.annualReturn).toBeCloseTo((Math.pow(1.005, 12) - 1) * 100, 1);   // 6,17 %
    expect(m.volatility).toBeCloseTo(0, 6);
    expect(m.maxDrawdown).toBe(0);
    expect(m.return1Y).toBeCloseTo(6.17, 1);
    expect(m.usable).toBe(true);
    expect(m.stale).toBe(false);
  });

  it('volatilitat = desviació mensual × √12', () => {
    // Alterna +2 % / −1 %: desviació mostral coneguda
    const pts = [{ date: '2023-01-31', nav: 100 }];
    const rets: number[] = [];
    for (let i = 1; i <= 36; i++) {
      const r = i % 2 ? 0.02 : -0.01; rets.push(r);
      const t = 2023 * 12 + i;
      const y = Math.floor(t / 12), mo = (t % 12) + 1;
      pts.push({ date: `${y}-${String(mo).padStart(2, '0')}-15`, nav: pts.at(-1)!.nav * (1 + r) });
    }
    const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
    const sd = Math.sqrt(rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1));
    const m = computeNavMetrics(pts, new Date('2026-02-01T00:00:00Z'));
    expect(m.volatility).toBeCloseTo(sd * Math.sqrt(12) * 100, 2);
    expect(m.maxDrawdown).toBeCloseTo(-1, 6);
  });

  it('caiguda màxima i pitjor any', () => {
    const pts = [...series(24, 0.01, '2022-01'), ...series(24, -0.02, '2024-02', 100 * Math.pow(1.01, 24)).slice(0)];
    const m = computeNavMetrics(pts, new Date('2026-02-10T00:00:00Z'));
    expect(m.maxDrawdown).toBeCloseTo((Math.pow(0.98, 24) - 1) * 100, 1);
    expect(m.worst12M).toBeCloseTo((Math.pow(0.98, 12) - 1) * 100, 1);
  });

  it(`no es fa servir amb menys de ${MIN_YEARS_FOR_PROPOSALS} anys`, () => {
    const m = computeNavMetrics(series(24, 0.005), asOf);
    expect(m.usable).toBe(false);
    expect(m.reason).toMatch(/Calen 3 anys/);
    expect(m.annualReturn).not.toBeNull();   // es mostra igualment
    expect(navPerformance(m)).toBeNull();
  });

  it('un mes sense preu bloqueja l\'ús i es diu quin', () => {
    const pts = series(48, 0.005).filter(p => !p.date.startsWith('2023-03'));
    const m = computeNavMetrics(pts, asOf);
    expect(m.missingMonths).toEqual(['2023-03']);
    expect(m.usable).toBe(false);
    expect(m.reason).toMatch(/Falten preus de 1 mes/);
  });

  it('només fa servir els últims 5 anys', () => {
    const m = computeNavMetrics(series(96, 0.005, '2018-10'), asOf);
    expect(m.months).toBe(60);
    expect(m.points).toBe(97);
  });

  it('marca desactualitzat amb l\'últim preu de fa més de 45 dies', () => {
    expect(computeNavMetrics(series(60, 0.005, '2021-06'), asOf).stale).toBe(true);
  });

  it('agafa l\'últim preu de cada mes', () => {
    expect(monthEndSeries([{ date: '2026-01-05', nav: 1 }, { date: '2026-01-30', nav: 2 }, { date: '2026-02-02', nav: 3 }]))
      .toEqual([{ month: '2026-01', date: '2026-01-30', nav: 2 }, { month: '2026-02', date: '2026-02-02', nav: 3 }]);
  });

  it('sense preus o amb un de sol', () => {
    expect(computeNavMetrics([]).reason).toMatch(/Encara no/);
    expect(computeNavMetrics([{ date: '2026-01-01', nav: 1 }]).reason).toMatch(/un preu/);
  });
});

describe('fundNavs (memòria) i propostes', () => {
  beforeEach(() => __resetNavsForTests());
  const rows = (months: number) => series(months, 0.006, '2021-10').map(p => ({ isin: ISIN, date: p.date, nav: p.nav, currency: 'EUR' }));

  it('desa, substitueix i esborra', async () => {
    await upsertNavs(rows(2));
    await upsertNavs([{ isin: ISIN, date: rows(2)[0].date, nav: 99, currency: 'EUR' }]);
    expect((await getNavs(ISIN)).map(p => p.nav)[0]).toBe(99);
    expect(await deleteNavs(ISIN, rows(2)[0].date)).toBe(1);
    expect(await getNavs(ISIN)).toHaveLength(2);
    expect(await deleteNavs(ISIN)).toBe(2);
  });

  it('avisa si es canvia la moneda d\'un fons ja desat', async () => {
    await upsertNavs(rows(1));
    expect(await currencyConflicts([{ isin: ISIN, date: '2026-10-31', nav: 1, currency: 'USD' }])).toHaveLength(1);
  });

  it('el resum inclou els fons de la llista encara sense preus', async () => {
    const s = await getNavSummary();
    expect(s.find(f => f.isin === ISIN)?.metrics.points).toBe(0);
  });

  it('amb prou historial, la proposta fa servir els preus entrats a mà', async () => {
    await upsertNavs(rows(60));
    const navs = await getNavPerformanceMap();
    expect(navs[ISIN].source).toMatch(/Preus entrats a mà \(5 anys/);
    const perf = verifiedPerformance(ISIN, navs);
    expect(perf.historicalReturn5Y).toBeCloseTo((Math.pow(1.006, 12) - 1) * 100, 1);
    const item = fundToItem(ISIN, 50, navs)!;
    expect(hasPerformanceData(item)).toBe(true);
    // Sense el mapa, el mateix fons no té dades (no hi ha fitxa)
    expect(hasPerformanceData(fundToItem(ISIN, 50)!)).toBe(false);
  });

  it('un ISIN fora de la llista amb preus es pot afegir a la proposta', async () => {
    const other = 'IE00B4L5Y983';   // iShares Core MSCI World
    await upsertNavs(series(48, 0.005, '2022-10').map(p => ({ isin: other, date: p.date, nav: p.nav, currency: 'EUR', name: 'iShares Core MSCI World' })));
    const item = fundToItem(other, 10, await getNavPerformanceMap());
    expect(item?.name).toMatch(/iShares Core MSCI World/);
    expect(hasPerformanceData(item!)).toBe(true);
  });
});

describe('validació de qualitat dels preus', () => {
  it('un preu mal teclejat bloqueja el fons i es diu quin', () => {
    const pts = series(40, 0.005);
    pts[20] = { ...pts[20], nav: 100000 };
    const m = computeNavMetrics(pts, new Date('2025-03-01T00:00:00Z'));
    expect(m.usable).toBe(false);
    expect(m.suspect.length).toBeGreaterThan(0);
    expect(m.reason).toMatch(/Variació sospitosa/);
    expect(navPerformance(m)).toBeNull();
  });

  it('avisa del salt ja en revisar l\'enganxat', () => {
    const r = parseNavText(`${ISIN}\t30/09/2026\t100\n${ISIN}\t31/10/2026\t1000`);
    expect(r.warnings.some(w => /Comprova/.test(w.message))).toBe(true);
  });
});

describe('preus a les posicions dels clients', () => {
  const ISIN2 = 'IE0008248803';
  async function holding(priceSource: 'pending' | 'manual', priceLastUpdated: string) {
    const p = await createClientPortfolio({ clientId: `c-${Math.random()}`, clientName: 'Prova', name: 'Cartera', description: '', recommendations: '' } as never);
    return addHolding(p.id, {
      assetIsin: ISIN2, assetName: 'Vanguard Eurozone', assetCategory: '', broker: '', quantity: 10,
      avgEntryPrice: 50, currentPrice: 50, priceLastUpdated, priceSource, currency: 'EUR',
    });
  }
  const priceOf = async (id: string) => (await getAllClientPortfolios()).flatMap(p => p.holdings).find(h => h.id === id)!;

  it('un preu provisional d\'importació es substitueix encara que sigui més nou', async () => {
    const h = await holding('pending', '2026-11-16T10:00:00Z');
    await syncHoldingsToNavs([{ isin: ISIN2, date: '2026-10-31', nav: 60, currency: 'EUR' }]);
    expect((await priceOf(h.id)).currentPrice).toBe(60);
  });

  it('un preu real més nou no es trepitja', async () => {
    const h = await holding('manual', '2026-11-15');
    await syncHoldingsToNavs([{ isin: ISIN2, date: '2026-10-31', nav: 60, currency: 'EUR' }]);
    expect((await priceOf(h.id)).currentPrice).toBe(50);
  });

  it('esborrar el preu fa tornar a l\'anterior o deixa la posició pendent', async () => {
    const h = await holding('manual', '2026-10-31');
    await reconcileHoldingsAfterNavDelete(ISIN2, '2026-10-31', { isin: ISIN2, date: '2026-09-30', nav: 55, currency: 'EUR' });
    let x = await priceOf(h.id);
    expect([x.currentPrice, x.priceLastUpdated]).toEqual([55, '2026-09-30']);
    await reconcileHoldingsAfterNavDelete(ISIN2, undefined, null);
    x = await priceOf(h.id);
    expect(x.priceSource).toBe('pending');
  });
});

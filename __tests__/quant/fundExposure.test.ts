import { describe, it, expect } from 'vitest';
import {
  exposureBreakdown, fundExposure, fundRegions, fundSectors, countryRegion, sectorKey, companyKey,
  staleExposures, asOfLabel, REGIONS, SECTORS,
} from '@/lib/fundExposure';
import { FUND_EXPOSURE, EXPOSURE_ALIASES } from '@/lib/fundExposureData';
import { ADVISOR_ISINS } from '@/lib/fundClassification';

const sum = (o: Record<string, number>) => Object.values(o).reduce((s, v) => s + v, 0);

describe('Dades de diversificació per fons', () => {
  it('cada fitxa és d\'un fons de la llista, té data i font', () => {
    for (const [isin, e] of Object.entries(FUND_EXPOSURE)) {
      expect(ADVISOR_ISINS, isin).toContain(isin);
      expect(e.asOf, isin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.source.length, isin).toBeGreaterThan(5);
      expect(e.countries || e.sectors || e.top10, isin).toBeTruthy();
    }
    for (const [alt, main] of Object.entries(EXPOSURE_ALIASES)) expect(ADVISOR_ISINS, alt).toContain(alt), expect(ADVISOR_ISINS).toContain(main);
  });

  it('cada país i sector de les fitxes es reconeix (cap cau a «altres» per error de nom)', () => {
    for (const [isin, e] of Object.entries(FUND_EXPOSURE)) {
      for (const c of Object.keys(e.countries ?? {})) expect(countryRegion(c), `${isin} ${c}`).toBeDefined();
      for (const s of Object.keys(e.sectors ?? {})) expect(sectorKey(s), `${isin} ${s}`).toBeDefined();
      if (e.top10Total != null && e.top10?.length === 10) {
        const t = e.top10.reduce((s, h) => s + h.pct, 0);
        expect(Math.abs(t - e.top10Total), `${isin} top-10`).toBeLessThan(1.5);
      }
    }
  });

  it('regions i sectors de cada fons sumen 100', () => {
    for (const e of Object.values(FUND_EXPOSURE)) {
      const r = fundRegions(e); if (r) expect(sum(r as Record<string, number>)).toBeCloseTo(100, 6);
      const s = fundSectors(e); if (s) expect(sum(s as Record<string, number>)).toBeCloseTo(100, 6);
    }
  });

  it('el que la fitxa no detalla surt com a «no detallat», no es reparteix', () => {
    // Vanguard Global Stock: la fitxa només dona 10 països (95,8 %)
    const r = fundRegions(fundExposure('IE00B03HD191')!)!;
    expect(r.altres).toBeCloseTo(4.2, 6);
    expect(r.america_nord).toBeCloseTo(76.2, 6);
    // Azvalor Internacional: només 2 sectors publicats sobre un 94,78 % en accions
    const s = fundSectors(fundExposure('ES0112611001')!)!;
    expect(s.energia).toBeCloseTo(47.6 / 94.78 * 100, 6);
    expect(s.altres).toBeCloseTo((94.78 - 63.8) / 94.78 * 100, 6);
  });

  it('una altra classe del mateix fons fa servir la mateixa fitxa', () => {
    expect(fundExposure('IE00B03HCZ61')).toBe(FUND_EXPOSURE.IE00B03HD191);
  });
});

describe('Diversificació de la cartera', () => {
  it('100 % Vanguard Global Stock: ~76 % EUA i Canadà, tecnologia ~30 %, top-10 27,7 %', () => {
    const b = exposureBreakdown([{ isin: 'IE00B03HD191', weight: 100 }]);
    expect(b.equity).toBe(100);
    expect(b.region.america_nord).toBeCloseTo(76.2, 1);
    expect(b.sector.tecnologia).toBeCloseTo(29.8 / 100.1 * 100, 1);
    expect(b.size.gran).toBeCloseTo(100, 6);
    expect(b.top10).toBeCloseTo(27.7, 6);
    expect(b.companies[0].name).toMatch(/Apple/);
    expect(b.companies[0].pct).toBeCloseTo(5.7, 6);
    expect(b.missingFunds).toEqual([]);
    expect(asOfLabel(b)).toBe('a 31/10/2026');
  });

  it('regió, sector i mida només sobre la renda variable; la renda fixa no compta', () => {
    const b = exposureBreakdown([
      { isin: 'IE00B03HD191', weight: 50 },   // RV global
      { isin: 'IE00B18GC888', weight: 50 },   // RF global
    ]);
    expect(b.equity).toBeCloseTo(50, 6);
    expect(sum(b.region) + b.regionMissing).toBeCloseTo(100, 6);
    expect(b.region.america_nord).toBeCloseTo(76.2, 1);
    // L'empresa amb més pes pesa sobre el TOTAL de la cartera
    expect(b.companies[0].pct).toBeCloseTo(5.7 / 2, 6);
  });

  it('suma la mateixa empresa de diversos fons (Apple a MSCI World + S&P 500)', () => {
    const b = exposureBreakdown([
      { isin: 'IE00B03HD191', weight: 50 },
      { isin: 'IE0032126645', weight: 50 },
    ]);
    const apple = b.companies.find(c => /apple/i.test(c.name))!;
    expect(apple.pct).toBeCloseTo(5.7 / 2 + 7.7 / 2, 6);
    expect(companyKey('Alphabet Inc. Class A')).toBe(companyKey('Alphabet'));
    expect(companyKey('APPLE INC')).toBe(companyKey('Apple'));
  });

  it('un fons sense fitxa surt com a «sense dades», mai estimat', () => {
    const b = exposureBreakdown([
      { isin: 'IE00B03HD191', weight: 50 },
      { isin: 'LU2305834041', weight: 50, name: 'Invesco Continental European Small Cap' },
    ]);
    expect(b.missingFunds).toEqual(['Invesco Continental European Small Cap']);
    expect(b.regionMissing).toBeCloseTo(50, 6);
    expect(b.sizeMissing).toBeCloseTo(50, 6);
    expect(sum(b.region) + b.regionMissing).toBeCloseTo(100, 6);
    expect(sum(b.sector) + b.sectorMissing).toBeCloseTo(100, 6);
    expect(sum(b.size) + b.sizeMissing).toBeCloseTo(100, 6);
  });

  it('cartera sense renda variable: res a repartir', () => {
    const b = exposureBreakdown([{ isin: 'IE00B18GC888', weight: 100 }]);
    expect(b.equity).toBe(0);
    expect(sum(b.region)).toBe(0);
    expect(b.top10).toBeNull();
    expect(exposureBreakdown([]).equity).toBe(0);
  });

  it('les claus de regió i sector són les esperades', () => {
    expect(REGIONS).toContain('iberia');
    expect(SECTORS).toHaveLength(12);
  });
});

describe('Avís trimestral', () => {
  it('marca les fitxes de més de 120 dies', () => {
    const stale = staleExposures(new Date('2026-11-26T00:00:00Z')).map(s => s.isin);
    expect(stale).toContain('ES0112611001');      // Azvalor: informe semestral a 30/06/2026
    expect(stale).not.toContain('IE00B03HD191');  // Vanguard: fitxa d'octubre
    expect(staleExposures(new Date('2027-06-01T00:00:00Z')).length).toBe(Object.keys(FUND_EXPOSURE).length);
  });
});

describe('Top-10 amb altres fons', () => {
  it('un fons dins del top-10 no surt com a empresa (Horos Iberia → Horos Internacional)', () => {
    const b = exposureBreakdown([{ isin: 'ES0146311008', weight: 100 }]);
    expect(b.companies.some(c => /horos/i.test(c.name))).toBe(false);
    expect(b.top10).toBeCloseTo(51.0, 6);
  });
});

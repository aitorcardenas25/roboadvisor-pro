// Caigudes històriques dels fons i ordre de «Preus dels fons».
import { describe, it, expect } from 'vitest';
import { computeFundDrawdowns, dateLabel, drawdownEpisodes, isDailySeries, spanLabel, looksLikeDistributionClass, recoveryLabel, durationLabel, showDrawdownsByDefault } from '@/lib/drawdowns';
import { navAttention, sortByAttention, UPDATE_LAG_DAYS } from '@/lib/navMath';

/** Sèrie de final de mes a partir d'una llista de valors, començant a `start` (aaaa-mm). */
function monthly(values: number[], start = '2020-11'): { date: string; nav: number }[] {
  const [y0, m0] = start.split('-').map(Number);
  return values.map((nav, i) => {
    const t = y0 * 12 + (m0 - 1) + i;
    const y = Math.floor(t / 12), m = (t % 12) + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { date: `${y}-${String(m).padStart(2, '0')}-${last}`, nav };
  });
}

describe('drawdownEpisodes', () => {
  it('separa les caigudes, en troba el mínim i la recuperació', () => {
    //            0    1   2   3    4    5    6   7    8
    const s = monthly([100, 90, 80, 100, 110, 99, 105, 111, 100]);
    const eps = drawdownEpisodes(s);
    expect(eps).toHaveLength(3);
    // La més gran primer: 100 → 80 (-20 %), recuperada 1 mes després del mínim
    expect(eps[0]).toMatchObject({ peakDate: '2020-11-30', troughDate: '2021-01-31', depthPct: -20, monthsToTrough: 2, recoveryDate: '2021-02-28', monthsToRecover: 1, currentPct: null });
    // 110 → 99 (-10 %), recuperada al 111
    expect(eps[1]).toMatchObject({ peakDate: '2021-03-31', troughDate: '2021-04-30', depthPct: -10, recoveryDate: '2021-06-30', monthsToRecover: 2 });
    // 111 → 100 (-9,91 %), encara no recuperada
    expect(eps[2].recoveryDate).toBeNull();
    expect(eps[2].depthPct).toBeCloseTo(-9.91, 2);
    expect(eps[2].currentPct).toBeCloseTo(-9.91, 2);
  });

  it('ignora les caigudes més petites del 0,5 %', () => {
    expect(drawdownEpisodes(monthly([100, 99.8, 101, 102]))).toHaveLength(0);
  });

  it('un fons que només puja no té cap caiguda', () => {
    expect(drawdownEpisodes(monthly([100, 101, 102, 103]))).toEqual([]);
  });
});

describe('computeFundDrawdowns', () => {
  const meta = { isin: 'IE0007472115', name: 'Vanguard Euro Government Bond Index Fund EUR Acc', currency: 'EUR' };

  it('fa servir només l\'últim preu de cada mes (els preus diaris no canvien la mesura)', () => {
    const pts = [...monthly([100, 95, 100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145])];
    // Un preu a mitjan mes molt més baix: no compta perquè no és final de mes
    pts.splice(1, 0, { date: '2020-12-15', nav: 70 });
    const r = computeFundDrawdowns(meta, pts);
    expect(r.maxDrawdown).toBe(-5);
    expect(r.episodes).toHaveLength(1);
    expect(r.windowStart).toBe('2020-11-30');
  });

  it('avisa d\'historial curt i de que no inclou el 2022', () => {
    const r = computeFundDrawdowns(meta, monthly([100, 98, 101, 103, 99, 104], '2025-08'));
    expect(r.warnings.some(w => /Historial curt/.test(w))).toBe(true);
    expect(r.warnings.some(w => /2022/.test(w))).toBe(true);
  });

  it('no omple els mesos que falten: els llista i ho avisa', () => {
    const s = monthly(Array.from({ length: 40 }, (_, i) => 100 + i));
    const withGap = s.filter((_, i) => i !== 10 && i !== 11);
    const r = computeFundDrawdowns(meta, withGap);
    expect(r.missingMonths).toEqual(['2021-09', '2021-10']);
    expect(r.monthlyPoints).toBe(38);
    expect(r.warnings.some(w => /Falten preus de 2 mesos/.test(w))).toBe(true);
  });

  it('avisa de les classes de distribució', () => {
    const r = computeFundDrawdowns(meta, monthly(Array.from({ length: 40 }, (_, i) => 100 + i)), { distribution: true });
    expect(r.warnings.some(w => /distribució/.test(w))).toBe(true);
  });

  it('amb un preu sospitós no publica cap caiguda', () => {
    const vals = Array(40).fill(100); vals[20] = 10;   // error en teclejar
    const r = computeFundDrawdowns(meta, monthly(vals));
    expect(r.maxDrawdown).toBeNull();
    expect(r.episodes).toEqual([]);
    expect(r.warnings[0]).toMatch(/Preu sospitós/);
  });

  it('sense preus no inventa res', () => {
    const r = computeFundDrawdowns(meta, []);
    expect(r.maxDrawdown).toBeNull();
    expect(r.episodes).toEqual([]);
    expect(r.warnings[0]).toMatch(/No hi ha preus oficials/);
  });

  it('marca la caiguda encara no recuperada', () => {
    const r = computeFundDrawdowns(meta, monthly([100, 110, 90, 95, ...Array(36).fill(96)]));
    expect(r.episodes[0].recoveryDate).toBeNull();
    expect(r.episodes[0].peakDate).toBe('2020-12-31');
    expect(recoveryLabel(r.episodes[0])).toMatch(/Encara no s'ha recuperat/);
  });
});

describe('textos i perfils', () => {
  it('durades en mesos i anys', () => {
    expect(durationLabel(1)).toBe('1 mes');
    expect(durationLabel(7)).toBe('7 mesos');
    expect(durationLabel(12)).toBe('1 any');
    expect(durationLabel(31)).toBe('2 anys i 7 mesos');
  });
  it('classes de distribució pel nom', () => {
    expect(looksLikeDistributionClass('Polar Capital Biotechnology R EUR Dist')).toBe(true);
    expect(looksLikeDistributionClass('DWS Top Dividende LD')).toBe(true);
    expect(looksLikeDistributionClass('Fidelity Funds Global Equity Income ESG Fund A-Acc-EUR')).toBe(false);
    expect(looksLikeDistributionClass('Vanguard Global Stock Index Fund EUR Acc')).toBe(false);
  });
  it('la pàgina surt per defecte als perfils prudents', () => {
    expect(showDrawdownsByDefault('conservador')).toBe(true);
    expect(showDrawdownsByDefault('moderat')).toBe(true);
    expect(showDrawdownsByDefault('agressiu')).toBe(false);
    expect(showDrawdownsByDefault(null)).toBe(false);
  });
});

describe('ordre de «Preus dels fons»', () => {
  const asOf = new Date('2026-11-25T10:00:00Z');
  const row = (name: string, points: number, lastDate: string | null, usable: boolean, inList = true) => ({ name, inList, metrics: { points, lastDate, usable } });

  it('estat de cada fons', () => {
    expect(navAttention({ points: 0, lastDate: null, usable: false }, asOf)).toBe('empty');
    expect(navAttention({ points: 70, lastDate: '2026-11-16', usable: true }, asOf)).toBe('behind');
    expect(navAttention({ points: 70, lastDate: '2026-11-24', usable: true }, asOf)).toBe('ok');
    expect(navAttention({ points: 20, lastDate: '2026-11-24', usable: false }, asOf)).toBe('incomplete');
    // Un cap de setmana llarg no el marca com a endarrerit
    const fri = new Date(asOf.getTime() - UPDATE_LAG_DAYS * 86_400_000).toISOString().slice(0, 10);
    expect(navAttention({ points: 70, lastDate: fri, usable: true }, asOf)).toBe('ok');
  });

  it('primer els que no estan al dia (el més antic primer), després sense preus, després incomplets, al final els correctes', () => {
    const sorted = sortByAttention([
      row('A correcte', 79, '2026-11-24', true),
      row('B sense preus', 0, null, false),
      row('C endarrerit recent', 73, '2026-11-16', true),
      row('D incomplet', 21, '2026-11-23', false),
      row('E endarrerit antic', 50, '2026-10-01', true),
    ], asOf);
    expect(sorted.map(r => r.name)).toEqual(['E endarrerit antic', 'C endarrerit recent', 'B sense preus', 'D incomplet', 'A correcte']);
  });
});

describe('caigudes amb preus diaris', () => {
  /** Dies laborables des de `start` amb els valors donats. */
  function daily(values: number[], start = '2020-01-01'): { date: string; nav: number }[] {
    const out: { date: string; nav: number }[] = [];
    let t = Date.parse(`${start}T00:00:00Z`);
    for (const nav of values) {
      while ([0, 6].includes(new Date(t).getUTCDay())) t += 86_400_000;
      out.push({ date: new Date(t).toISOString().slice(0, 10), nav });
      t += 86_400_000;
    }
    return out;
  }
  const meta = { isin: 'IE00B03HD191', name: 'Vanguard Global Stock Index Fund EUR Acc', currency: 'EUR' };

  it('amb historial diari fa servir cada dia: veu la caiguda dins el mes', () => {
    // Puja, cau un 30 % en 3 setmanes i recupera dins el mateix mes següent
    const vals = [...Array(30).fill(0).map((_, i) => 100 + i * 0.1), ...Array(15).fill(0).map((_, i) => 102.9 - i * 2.06), ...Array(30).fill(0).map((_, i) => 72 + i * 1.1)];
    const r = computeFundDrawdowns(meta, daily(vals));
    expect(r.frequency).toBe('daily');
    expect(r.maxDrawdown!).toBeLessThan(-29);
    expect(r.episodes[0].daysToTrough).toBeGreaterThan(14);
    expect(r.episodes[0].daysToTrough).toBeLessThan(30);
  });

  it('un historial mensual amb unes setmanes diàries al final es tracta com a mensual', () => {
    const s = [...monthly(Array.from({ length: 60 }, (_, i) => 100 + i), '2020-11'), ...daily(Array(20).fill(170), '2025-11-03')];
    expect(isDailySeries(s.sort((a, b) => a.date.localeCompare(b.date)))).toBe(false);
  });

  it('textos amb dia exacte i durada en dies', () => {
    expect(dateLabel('2020-03-23', 'daily')).toBe('23/03/2020');
    expect(dateLabel('2020-03-31', 'monthly')).toBe('març 2020');
    expect(spanLabel(33, 1, 'daily')).toBe('33 dies');
    expect(spanLabel(400, 13, 'daily')).toBe('1 any i 1 mes');
    expect(spanLabel(31, 1, 'monthly')).toBe('1 mes');
  });
});

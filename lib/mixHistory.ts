// lib/mixHistory.ts — com hauria anat la cartera d'avui en els últims anys.
//
// Simulació amb els valors liquidatius oficials (fund_navs), sense inventar res:
// - Es compra la composició d'avui (pesos per valor) al final del mes d'inici
//   i no es toca (compra i mantenir, sense rebalancejar ni aportacions).
// - Un mes on algun fons no té preu no es dibuixa (no s'interpola).
// - Si algun fons té menys història que la demanada, la finestra s'escurça i es diu.
// Mètriques (CAGR, volatilitat, caiguda màxima, pitjor any): computeNavMetrics
// (Sharpe 1966; Magdon-Ismail & Atiya 2004), aplicades al valor simulat.

import { computeNavMetrics, monthEndSeries, type NavPoint } from './navMath';

export interface MixWeight { isin: string; name: string; weight: number }   // pes en %, suma 100

export interface MixStats {
  totalReturn:  number | null;   // % de tota la finestra
  annualReturn: number | null;   // % anual (CAGR)
  volatility:   number | null;   // % anual
  maxDrawdown:  number | null;   // % (negatiu)
  worst12M:     number | null;   // pitjor rendiment de 12 mesos seguits, %
}

export interface MixHistory {
  years:       number;           // anys realment coberts
  requested:   number;           // anys demanats
  start:       string;           // data del primer punt
  end:         string;           // data de l'últim punt
  initial:     number;           // import simulat inicial (€)
  limitedBy:   string | null;    // fons que escurça la finestra, si n'hi ha
  points:      { date: string; value: number; funds: Record<string, number> }[];
  portfolio:   MixStats;
  funds:       (MixWeight & MixStats)[];
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const monthIndex = (ym: string) => { const [y, m] = ym.split('-').map(Number); return y * 12 + m - 1; };

function stats(series: { date: string; nav: number }[]): MixStats {
  if (series.length < 2) return { totalReturn: null, annualReturn: null, volatility: null, maxDrawdown: null, worst12M: null };
  // Tota la finestra simulada (fins a 10 anys), no només els últims 60 mesos
  const m = computeNavMetrics(series, new Date(series.at(-1)!.date + 'T00:00:00Z'), 12 * 11);
  return {
    totalReturn: r2((series.at(-1)!.nav / series[0].nav - 1) * 100),
    annualReturn: m.annualReturn, volatility: m.volatility, maxDrawdown: m.maxDrawdown, worst12M: m.worst12M,
  };
}

/**
 * Simula `weights` comprats fa `years` anys amb `initial` €, a final de mes.
 * Retorna null si algun fons no té cap preu o si no hi ha almenys dos mesos en comú.
 * `alignWith`: fons d'una altra cartera que es vol comparar. Només es fan servir
 * els mesos en què TOTS (els d'aquesta i els d'aquella) tenen preu, perquè les
 * dues simulacions cobreixin exactament el mateix període.
 */
export function simulateMix(weights: MixWeight[], navs: NavPoint[], years: number, initial = 10_000, alignWith: MixWeight[] = []): MixHistory | null {
  const ws = weights.filter(w => w.weight > 0);
  if (!ws.length) return null;
  const all = [...ws, ...alignWith.filter(a => a.weight > 0 && !ws.some(w => w.isin === a.isin))];
  const series = new Map<string, Map<string, { date: string; nav: number }>>();
  for (const w of all) {
    const s = monthEndSeries(navs.filter(n => n.isin === w.isin && n.nav > 0));
    if (s.length < 2) return null;
    series.set(w.isin, new Map(s.map(p => [p.month, { date: p.date, nav: p.nav }])));
  }

  // Últim mes en què tots tenen preu, i inici = aquest mes − anys (o el primer mes comú)
  const months = (isin: string) => [...series.get(isin)!.keys()].sort();
  const common = months(ws[0].isin).filter(m => all.every(w => series.get(w.isin)!.has(m)));
  if (common.length < 2) return null;
  const lastM = common.at(-1)!;
  const wanted = monthIndex(lastM) - years * 12;
  const firsts = all.map(w => ({ w, first: months(w.isin)[0] }));
  const latestFirst = firsts.reduce((a, b) => (b.first > a.first ? b : a));
  const startM = common.find(m => monthIndex(m) >= wanted)!;
  const limitedBy = monthIndex(latestFirst.first) > wanted ? latestFirst.w.name : null;
  const used = common.filter(m => m >= startM);
  if (used.length < 2) return null;

  // Participacions comprades el mes d'inici
  const units = new Map(ws.map(w => [w.isin, (initial * w.weight / 100) / series.get(w.isin)!.get(startM)!.nav]));
  const total = ws.reduce((s, w) => s + w.weight, 0);
  const scale = total > 0 ? 100 / total : 1;   // si els pesos no sumen 100, es reparteix l'import igual

  const points = used.map(m => {
    const funds: Record<string, number> = {};
    let value = 0;
    for (const w of ws) {
      const p = series.get(w.isin)!.get(m)!;
      value += units.get(w.isin)! * p.nav * scale;
      funds[w.isin] = r2(initial * p.nav / series.get(w.isin)!.get(startM)!.nav);   // el fons sol, amb el mateix import
    }
    const date = ws.map(w => series.get(w.isin)!.get(m)!.date).sort().at(-1)!;
    return { date, value: r2(value), funds };
  });

  return {
    years: r2((monthIndex(lastM) - monthIndex(startM)) / 12),
    requested: years,
    start: points[0].date,
    end: points.at(-1)!.date,
    initial,
    limitedBy,
    points,
    portfolio: stats(points.map(p => ({ date: p.date, nav: p.value }))),
    funds: ws.map(w => ({ ...w, ...stats(points.map(p => ({ date: p.date, nav: p.funds[w.isin] }))) })),
  };
}

/** Dues composicions iguals (cada pes a ±`tolerance` punts)? Llavors no cal comparar-les. */
export function sameMix(a: MixWeight[], b: MixWeight[], tolerance = 2): boolean {
  const isins = new Set([...a, ...b].filter(w => w.weight > 0).map(w => w.isin));
  const w = (list: MixWeight[], isin: string) => list.filter(x => x.isin === isin).reduce((s, x) => s + x.weight, 0);
  return [...isins].every(i => Math.abs(w(a, i) - w(b, i)) <= tolerance);
}

/** Finestres que es mostren: 10 anys només si tots els fons hi arriben. */
export const MIX_WINDOWS = [1, 3, 5, 10] as const;

/**
 * Les dues simulacions per a cada finestra, sobre els mateixos mesos.
 * La de 10 anys només surt si no queda escurçada per cap fons.
 */
export function simulateWindows(weights: MixWeight[], navs: NavPoint[], alignWith: MixWeight[] = []): Record<string, MixHistory | null> {
  const out: Record<string, MixHistory | null> = {};
  for (const y of MIX_WINDOWS) {
    const h = simulateMix(weights, navs, y, 10_000, alignWith);
    out[String(y)] = y > 5 && (!h || h.limitedBy) ? null : h;
  }
  return out;
}

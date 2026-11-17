// lib/portfolioValuation.ts — part pura (sense BD), usable també des del navegador.
//
// 1) planApplication: converteix una proposta aprovada (pesos) en compres
//    concretes (participacions) amb el valor liquidatiu oficial del dia.
// 2) valuationSeries: valor mensual de la cartera REAL calculat amb els
//    valors liquidatius de fund_navs (participacions × VL a final de mes),
//    en lloc dels snapshots entrats a mà.
//
// Regla del projecte: cap preu inventat. Si a un fons li falta el preu, no es
// compra (planApplication retorna el problema) i aquell mes no surt al gràfic.

import type { NavPoint } from './navMath';

export interface ApplyItem { isin: string; name: string; category: string; weight: number }

export interface ApplyLine {
  isin:     string;
  name:     string;
  category: string;
  weight:   number;   // 0–100
  amount:   number;   // € invertits
  nav:      number;   // valor liquidatiu de compra
  navDate:  string;   // data d'aquest valor (≤ data de compra)
  quantity: number;   // participacions
  currency: string;
}

export interface ApplyPlan { lines: ApplyLine[]; problems: string[] }

/** Preu més antic acceptat per comprar: un VL de fa més de 45 dies no és el preu del dia. */
export const MAX_PRICE_AGE_DAYS = 45;

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Agrupa els preus per ISIN, ordenats per data. */
export function navsByIsin(navs: NavPoint[]): Map<string, NavPoint[]> {
  const m = new Map<string, NavPoint[]>();
  for (const p of navs) {
    const k = p.isin.toUpperCase();
    (m.get(k) ?? m.set(k, []).get(k)!).push(p);
  }
  for (const list of m.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return m;
}

/** Últim preu amb data ≤ `date` (cerca binària). */
export function navOnOrBefore(list: NavPoint[] | undefined, date: string): NavPoint | null {
  if (!list?.length) return null;
  let lo = 0, hi = list.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].date <= date) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return best >= 0 ? list[best] : null;
}

/**
 * Compres per invertir `amount` € el dia `date` segons els pesos de la
 * proposta. Cada fons es compra al seu últim VL oficial fins a aquella data.
 */
export function planApplication(items: ApplyItem[], amount: number, date: string, navs: NavPoint[]): ApplyPlan {
  const problems: string[] = [];
  const lines: ApplyLine[] = [];
  if (!(amount > 0)) problems.push('L\'import a invertir ha de ser més gran que 0.');
  const active = items.filter(i => i.weight > 0);
  if (!active.length) problems.push('La proposta no té cap fons amb pes.');
  const total = active.reduce((s, i) => s + i.weight, 0);
  if (active.length && Math.abs(total - 100) > 0.5) problems.push(`Els pesos sumen ${round(total, 2)} %, no 100 %.`);
  const by = navsByIsin(navs);

  for (const it of active) {
    const p = navOnOrBefore(by.get(it.isin.toUpperCase()), date);
    if (!p) { problems.push(`${it.name} (${it.isin}): no hi ha cap valor liquidatiu oficial fins al ${date}.`); continue; }
    if (p.currency.toUpperCase() !== 'EUR') { problems.push(`${it.name} (${it.isin}): els preus són en ${p.currency}; la cartera es porta en EUR.`); continue; }
    const age = daysBetween(p.date, date);
    if (age > MAX_PRICE_AGE_DAYS) {
      problems.push(`${it.name} (${it.isin}): l'últim valor liquidatiu és del ${p.date} (${age} dies abans). Carrega preus més recents.`);
      continue;
    }
    const lineAmount = round(amount * it.weight / 100, 2);
    lines.push({
      isin: it.isin.toUpperCase(), name: it.name, category: it.category, weight: it.weight,
      amount: lineAmount, nav: p.nav, navDate: p.date, quantity: round(lineAmount / p.nav, 6), currency: p.currency,
    });
  }
  return { lines: problems.length ? [] : lines, problems };
}

// ─── Evolució de la cartera real ──────────────────────────────────────────────

export interface ValuationHolding { id: string; assetIsin: string; assetName: string; quantity: number; avgEntryPrice: number; createdAt: string }
export interface ValuationTx { holdingId?: string; operationType: string; date: string; quantity: number; totalEur: number; commission: number }

export interface ValuationPoint { date: string; value: number; invested: number }
export interface Valuation {
  points:  ValuationPoint[];
  missing: string[];    // fons sense cap preu: no es pot calcular el total
  source:  'navs';
}

/** Últim dia de cada mes entre dues dates (incloses), en format aaaa-mm-dd. */
export function monthEnds(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
  for (;;) {
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    if (end > to) break;
    out.push(end);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

interface Step { date: string; qty: number; cash: number }

/** Moviments de participacions i diners de cada posició. */
function stepsFor(h: ValuationHolding, txs: ValuationTx[]): Step[] {
  const own = txs.filter(t => t.holdingId === h.id && (t.operationType === 'buy' || t.operationType === 'sell'));
  const fromTx = own.map(t => t.operationType === 'buy'
    ? { date: t.date.slice(0, 10), qty: t.quantity, cash: t.totalEur + (t.commission || 0) }
    : { date: t.date.slice(0, 10), qty: -t.quantity, cash: -(t.totalEur - (t.commission || 0)) });
  const sum = fromTx.reduce((s, x) => s + x.qty, 0);
  // Si les operacions no quadren amb la posició (p. ex. posició entrada a mà
  // sense compres), es fa servir la posició actual des de la primera data.
  if (fromTx.length && Math.abs(sum - h.quantity) < 1e-6 * Math.max(1, h.quantity)) {
    return fromTx.sort((a, b) => a.date.localeCompare(b.date));
  }
  const start = [fromTx.map(x => x.date).sort()[0], h.createdAt.slice(0, 10)].filter(Boolean).sort()[0]!;
  return [{ date: start, qty: h.quantity, cash: h.avgEntryPrice * h.quantity }];
}

/**
 * Valor de la cartera a cada final de mes (i el dia de la primera compra),
 * amb els valors liquidatius oficials. Un mes on algun fons no té preu
 * d'aquell mes no surt (no s'inventa cap valor).
 */
export function valuationSeries(holdings: ValuationHolding[], txs: ValuationTx[], navs: NavPoint[], today = new Date().toISOString().slice(0, 10)): Valuation {
  // També les posicions ja venudes del tot: en dates passades formaven part de la cartera.
  const traded = new Set(txs.filter(t => t.holdingId && (t.operationType === 'buy' || t.operationType === 'sell')).map(t => t.holdingId!));
  const live = holdings.filter(h => h.quantity > 0 || traded.has(h.id));
  const by = navsByIsin(navs);
  // Sense preus, o amb preus en una altra moneda (no es converteixen aquí), no es calcula res.
  const missing = live.flatMap(h => {
    const list = by.get(h.assetIsin.toUpperCase());
    if (!list?.length) return [h.assetName];
    const cur = list.find(p => p.currency.toUpperCase() !== 'EUR')?.currency;
    return cur ? [`${h.assetName} (preus en ${cur})`] : [];
  });
  if (!live.length || missing.length) return { points: [], missing, source: 'navs' };

  const steps = new Map(live.map(h => [h.id, stepsFor(h, txs)]));
  const first = [...steps.values()].flat().map(s => s.date).sort()[0];
  // Fins a l'últim preu del fons que encara es té i que té el preu més antic
  const held = live.filter(h => h.quantity > 0);
  const lastNav = held.length
    ? held.map(h => by.get(h.assetIsin.toUpperCase())!.at(-1)!.date).sort()[0]
    : [...steps.values()].flat().map(s => s.date).sort().at(-1)!;
  const end = lastNav < today ? lastNav : today;
  const dates = [first, ...monthEnds(first, end).filter(d => d > first)];
  if (end > dates.at(-1)!) dates.push(end);   // mes en curs: fins a l'últim preu

  const points: ValuationPoint[] = [];
  for (const d of dates) {
    let value = 0, invested = 0, ok = true, any = false;
    for (const h of live) {
      const st = steps.get(h.id)!.filter(s => s.date <= d);
      const qty = st.reduce((s, x) => s + x.qty, 0);
      invested += st.reduce((s, x) => s + x.cash, 0);
      if (qty <= 1e-9) continue;
      any = true;
      const p = navOnOrBefore(by.get(h.assetIsin.toUpperCase()), d);
      if (!p || daysBetween(p.date, d) > MAX_PRICE_AGE_DAYS) { ok = false; break; }
      value += qty * p.nav;
    }
    if (ok && any) points.push({ date: d, value: round(value, 2), invested: round(invested, 2) });
  }
  // Dates repetides (primera compra a final de mes)
  const uniq = points.filter((p, i) => i === 0 || p.date !== points[i - 1].date);
  return { points: uniq, missing: [], source: 'navs' };
}

// ─── Evolució per períodes (Excel del client) ─────────────────────────────────

export type Period = 'month' | 'quarter' | 'year';

export interface PeriodRow {
  date:        string;   // final del període (o l'últim preu, si és el període en curs)
  value:       number;   // valor de mercat
  invested:    number;   // capital net aportat acumulat
  flow:        number;   // aportacions netes dins del període
  gain:        number;   // guany del període en € (sense comptar aportacions)
  periodReturn: number | null;  // % del període (Modified Dietz)
  totalReturn: number | null;   // % acumulat sobre el capital aportat
}

const isPeriodEnd = (d: string, period: Period) => {
  const m = Number(d.slice(5, 7));
  const last = new Date(Date.UTC(Number(d.slice(0, 4)), m, 0)).toISOString().slice(0, 10) === d;
  if (!last) return false;
  return period === 'month' || (period === 'quarter' ? m % 3 === 0 : m === 12);
};

/**
 * Agrupa la sèrie mensual per mesos, trimestres o anys. La rendibilitat de
 * cada període descompta les aportacions amb el mètode Modified Dietz
 * (Dietz, 1968), suposant les aportacions a mig període:
 *   r = (V1 − V0 − CF) / (V0 + CF / 2)
 */
export function aggregatePeriods(points: ValuationPoint[], period: Period): PeriodRow[] {
  if (!points.length) return [];
  const keep = points.filter((p, i) => i === 0 || i === points.length - 1 || isPeriodEnd(p.date, period));
  const rows: PeriodRow[] = [];
  keep.forEach((p, i) => {
    const prev = i ? keep[i - 1] : null;
    const flow = prev ? p.invested - prev.invested : p.invested;
    const gain = prev ? p.value - prev.value - flow : p.value - p.invested;
    const base = prev ? prev.value + flow / 2 : 0;
    rows.push({
      date: p.date, value: p.value, invested: p.invested, flow: round(flow, 2), gain: round(gain, 2),
      periodReturn: prev && base > 0 ? round(gain / base * 100, 2) : null,
      totalReturn: p.invested > 0 ? round((p.value / p.invested - 1) * 100, 2) : null,
    });
  });
  return rows;
}

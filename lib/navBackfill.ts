// lib/navBackfill.ts — carrega l'històric diari complet d'un fons des de la seva
// font oficial (la mateixa que l'actualització diària, lib/navFeeds.ts).
// Decisió de l'Aitor (2026-11-25): calcular les caigudes des de l'inici de cada fons.
//
// Regles (no s'inventa res):
// - Només fons que ja tenen preus a l'app i font automàtica.
// - Abans de desar, els preus de la font han de coincidir amb els ja desats
//   (mateixa classe i moneda): si no, no es desa res.
// - Els preus ja desats no es toquen; només s'afegeixen els dies que falten.
//   Excepció: les classes de distribució ajustades pels dividends (iShares), on
//   l'ajust depèn de tot l'historial i la sèrie es reescriu sencera.
// - Dòlars → euros amb el canvi oficial del BCE del mateix dia (o l'anterior).
//   Un dia sense canvi del BCE no es desa.
// - Un salt de més del 40 % d'un dia al següent (error probable) atura la càrrega.

import { NAV_SOURCES, PROVIDER_LABEL, ecbUsdRates, fetchFeed, usdToEur, type FeedDistribution, type FeedPoint } from './navFeeds';
import { deleteNavs, getMonthEndNavs, getNavs, upsertNavs } from './fundNavs';
import { lookupIsin } from './fundUniverse';
import { MAX_MOVE_PCT, suspectMoves, type NavPoint } from './navMath';
import { madridToday } from './navAutoUpdate';

/** Diferència màxima admesa entre la font i un preu desat el mateix dia. */
export const MATCH_TOLERANCE = 0.005;
/** Percentatge màxim de dies comuns que poden no coincidir (arrodoniments puntuals). */
export const MAX_MISMATCH_SHARE = 0.01;
export const HISTORY_SINCE = '1985-01-01';

export interface BackfillResult {
  isin:      string;
  name:      string;
  source:    string;
  status:    'loaded' | 'nothing_new' | 'failed' | 'no_source';
  added:     number;          // preus nous desats
  replaced?: boolean;         // sèrie reescrita sencera (classe de distribució ajustada)
  firstDate: string | null;   // primer preu després de la càrrega
  checked:   number;          // dies comuns comparats amb els desats
  skipped:   number;          // dies sense canvi del BCE (no desats)
  message?:  string;
}

/**
 * Factors de dividend acumulats: cada preu es multiplica pel producte dels
 * factors P_ex / (P_ex + D) dels dies ex-dividend posteriors (com lib/navAutoUpdate.ts).
 */
export function adjustForDistributions(points: FeedPoint[], dists: FeedDistribution[]): FeedPoint[] {
  const factors = dists.map(d => {
    const pEx = points.find(p => p.date === d.exDate && p.currency === d.currency);
    return pEx ? { exDate: d.exDate, factor: pEx.nav / (pEx.nav + d.amount) } : null;
  }).filter((f): f is { exDate: string; factor: number } => !!f).sort((a, b) => b.exDate.localeCompare(a.exDate));
  let k = 1, j = 0;
  return [...points].sort((a, b) => b.date.localeCompare(a.date)).map(p => {
    while (j < factors.length && factors[j].exDate > p.date) k *= factors[j++].factor;
    return { ...p, nav: Math.round(p.nav * k * 1e6) / 1e6 };
  }).reverse();
}

/**
 * Compara la sèrie de la font amb la desada i decideix què es desa.
 * Pur: no llegeix ni escriu res (tests a __tests__/quant/navBackfill.test.ts).
 */
export function planBackfill(stored: Pick<NavPoint, 'date' | 'nav'>[], source: FeedPoint[], opts: { replaceAll?: boolean } = {}):
  { ok: true; rows: FeedPoint[]; checked: number } | { ok: false; message: string; checked: number } {
  const byDate = new Map(source.map(p => [p.date, p]));
  const common = stored.filter(s => byDate.has(s.date));
  if (stored.length && !common.length) return { ok: false, checked: 0, message: 'la font no té cap dia en comú amb els preus desats; no es pot comprovar que sigui la mateixa classe' };
  // Amb la sèrie reescrita (dividends), només es comparen els dies posteriors a l'últim ajust:
  // els anteriors canvien per força. Si no n'hi ha, es comprova l'últim dia comú.
  const toCheck = opts.replaceAll ? common.slice(-20) : common;
  const bad = toCheck.filter(s => Math.abs(byDate.get(s.date)!.nav / s.nav - 1) > MATCH_TOLERANCE);
  const lastCommon = toCheck.at(-1);
  if (lastCommon && bad.includes(lastCommon)) {
    const v = byDate.get(lastCommon.date)!.nav;
    return { ok: false, checked: toCheck.length, message: `el preu de la font del ${lastCommon.date} (${v}) no coincideix amb el desat (${lastCommon.nav}); pot ser una altra classe del fons` };
  }
  if (bad.length > Math.max(1, toCheck.length * MAX_MISMATCH_SHARE)) {
    return { ok: false, checked: toCheck.length, message: `${bad.length} de ${toCheck.length} dies no coincideixen amb els preus desats (primer: ${bad[0].date}); no s'ha desat res` };
  }
  const have = new Set(stored.map(s => s.date));
  const rows = opts.replaceAll ? source : source.filter(p => !have.has(p.date));
  // Sèrie resultant (desats + nous) sense salts impossibles
  const merged = opts.replaceAll ? rows : [...stored.map(s => ({ date: s.date, nav: s.nav })), ...rows];
  const jump = suspectMoves(merged)[0];
  if (jump) return { ok: false, checked: toCheck.length, message: `salt de ${jump.change} % el ${jump.date} (més del ${MAX_MOVE_PCT} %): no s'ha desat res` };
  return { ok: true, rows, checked: toCheck.length };
}

/** Isins que es poden carregar: amb font automàtica i preus a l'app. */
export async function backfillCandidates(): Promise<{ isin: string; name: string; source: string; firstDate: string }[]> {
  const first = new Map<string, string>();
  for (const p of await getMonthEndNavs()) if (!first.has(p.isin)) first.set(p.isin, p.date);
  return NAV_SOURCES.filter(s => first.has(s.isin))
    .map(s => ({ isin: s.isin, name: lookupIsin(s.isin)?.name ?? s.isin, source: PROVIDER_LABEL[s.provider], firstDate: first.get(s.isin)! }));
}

export async function backfillFund(isin: string, opts: { fetchFn?: typeof fetch; now?: Date } = {}): Promise<BackfillResult> {
  const src = NAV_SOURCES.find(s => s.isin === isin);
  const stored = await getNavs(isin);
  const name = lookupIsin(isin)?.name ?? [...stored].reverse().find(p => p.name)?.name ?? isin;
  const base: BackfillResult = { isin, name, source: src ? PROVIDER_LABEL[src.provider] : 'entrada a mà', status: 'failed', added: 0, firstDate: stored[0]?.date ?? null, checked: 0, skipped: 0 };
  if (!src) return { ...base, status: 'no_source', message: 'aquest fons no té cap font automàtica: l\'històric s\'ha d\'entrar a mà' };
  if (!stored.length) return { ...base, message: 'el fons encara no té preus a l\'app' };
  try {
    const today = madridToday(opts.now);
    const feed = await fetchFeed(src, { since: HISTORY_SINCE, today, fetchFn: opts.fetchFn });
    const currency = stored.at(-1)!.currency;
    let pts = feed.points.filter(p => p.nav > 0).sort((a, b) => a.date.localeCompare(b.date));
    if (!pts.length) return { ...base, message: 'la font no ha retornat cap preu' };
    if (src.adjustDistributions) pts = adjustForDistributions(pts, feed.distributions ?? []);
    let skipped = 0;
    if (pts.some(p => p.currency !== currency)) {
      if (currency !== 'EUR' || pts.some(p => p.currency !== 'USD' && p.currency !== 'EUR')) {
        return { ...base, message: `la font dona preus en ${pts.find(p => p.currency !== currency)!.currency} i a l'app el fons és en ${currency}` };
      }
      const rates = await ecbUsdRates({ since: HISTORY_SINCE, today, fetchFn: opts.fetchFn }, pts[0].date < '1999-01-04' ? '1999-01-04' : pts[0].date);
      const conv: FeedPoint[] = [];
      for (const p of pts) {
        const v = p.currency === 'USD' ? usdToEur(p, rates) : p;
        if (v) conv.push(v); else skipped++;
      }
      pts = conv;
    }
    const plan = planBackfill(stored, pts, { replaceAll: !!src.adjustDistributions });
    if (!plan.ok) return { ...base, checked: plan.checked, skipped, message: plan.message };
    if (!plan.rows.length) return { ...base, status: 'nothing_new', checked: plan.checked, skipped };
    const rows: NavPoint[] = plan.rows.map(p => ({ isin, date: p.date, nav: p.nav, currency: p.currency, name }));
    if (src.adjustDistributions) {
      // Primer els nous (upsert), després s'esborren els dies que la font ja no té
      await upsertNavs(rows);
      const keep = new Set(rows.map(r => r.date));
      for (const s of stored) if (!keep.has(s.date)) await deleteNavs(isin, s.date);
    } else {
      await upsertNavs(rows);
    }
    const first = [rows[0].date, stored[0].date].sort()[0];
    return { ...base, status: 'loaded', added: src.adjustDistributions ? rows.length - stored.length : rows.length, replaced: !!src.adjustDistributions, firstDate: first, checked: plan.checked, skipped };
  } catch (err) {
    return { ...base, message: err instanceof Error ? err.message : String(err) };
  }
}

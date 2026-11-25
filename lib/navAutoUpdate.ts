// lib/navAutoUpdate.ts — actualització diària dels preus dels fons (13:00 a Madrid).
//
// Per a cada fons amb preus a l'app: llegeix la font oficial (lib/navFeeds.ts),
// desa els dies nous a fund_navs, passa l'últim preu a les posicions dels
// clients i deixa un resum a l'audit log perquè l'admin vegi què ha fallat.

import { getDb } from './supabase';
import { logAuditEventAndWait, getAuditLog } from './auditLog';
import { lookupIsin } from './fundUniverse';
import { getNavs, upsertNavs } from './fundNavs';
import { syncHoldingsToNavs } from './clientPortfolios';
import type { NavPoint } from './navMath';
import {
  MANUAL_ONLY, NAV_SOURCES, PROVIDER_LABEL, ecbUsdRates, fetchFeed, usdToEur,
  type FeedContext, type FeedDistribution, type FeedPoint, type FeedSource,
} from './navFeeds';

export type FundUpdateStatus = 'updated' | 'up_to_date' | 'stale' | 'failed' | 'manual';

export interface FundUpdate {
  isin:      string;
  name:      string;
  status:    FundUpdateStatus;
  source:    string;
  added:     number;         // dies nous desats
  lastDate:  string | null;  // últim preu desat després de l'execució
  message?:  string;
}

export interface AutoUpdateSummary {
  startedAt:  string;
  finishedAt: string;
  trigger:    'cron' | 'admin';
  today:      string;
  funds:      FundUpdate[];
  counts:     Record<FundUpdateStatus, number>;
  holdingsUpdated: number;
}

/** Dies sense preu nou a partir dels quals un fons es considera endarrerit (dies laborables). */
export const STALE_WORKDAYS = 3;
/** Variació màxima acceptada entre dos preus seguits: més és gairebé segur una classe equivocada. */
const MAX_DAILY_JUMP = 0.15;
/** Diferència màxima entre la font i el preu desat el mateix dia (arrodoniments, canvi del BCE). */
const MATCH_TOLERANCE = 0.005;
const LOOKBACK_DAYS = 21;
const CONCURRENCY = 6;

export const madridToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** Dies laborables entre dues dates (sense comptar la primera). */
export function workdaysAfter(from: string, to: string): number {
  let n = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

/** Últim preu desat de cada ISIN (amb la data, el valor i la moneda). */
async function lastStored(): Promise<Map<string, NavPoint>> {
  const out = new Map<string, NavPoint>();
  for (const p of await getNavs()) out.set(p.isin, p);   // getNavs ve ordenat per ISIN i data
  return out;
}

/**
 * Factors per ajustar l'històric d'una classe de distribució: el dia que el
 * fons descompta un dividend, tots els preus anteriors es multipliquen per
 * P_ex / (P_ex + D), com es va fer amb l'històric (vegeu cobertura-historics.md).
 */
export function distributionFactors(dists: FeedDistribution[], rawPoints: FeedPoint[], after: string): { exDate: string; factor: number }[] {
  const out: { exDate: string; factor: number }[] = [];
  for (const d of dists) {
    if (d.exDate <= after) continue;
    const pEx = rawPoints.find(p => p.date === d.exDate && p.currency === d.currency);
    if (!pEx) continue;   // encara no tenim el preu del dia ex-dividend
    out.push({ exDate: d.exDate, factor: pEx.nav / (pEx.nav + d.amount) });
  }
  return out.sort((a, b) => a.exDate.localeCompare(b.exDate));
}

/**
 * Aplica un factor de dividend als preus desats anteriors al dia ex-dividend.
 * És idempotent: compara l'últim preu desat abans d'aquell dia amb el preu
 * sense ajustar de la font. Si encara coincideixen, s'ajusta; si ja coincideix
 * amb el preu ajustat (una altra execució ja ho ha fet), no es torna a aplicar.
 */
export async function applyDistributionAdjustment(
  isin: string, exDate: string, factor: number, rawStored: Map<string, number>,
): Promise<'applied' | 'already'> {
  const before = (await getNavs(isin)).filter(p => p.date < exDate);
  if (!before.length) return 'already';
  const ref = [...before].reverse().find(p => rawStored.has(p.date));
  if (!ref) throw new Error(`no es pot comprovar l'ajust pel dividend del ${exDate}: la font no dona preus dels dies anteriors`);
  const raw = rawStored.get(ref.date)!;
  if (Math.abs(ref.nav / (raw * factor) - 1) <= MATCH_TOLERANCE / 5) return 'already';
  if (Math.abs(ref.nav / raw - 1) > MATCH_TOLERANCE) {
    throw new Error(`el preu desat del ${ref.date} no coincideix amb la font; no s'ha ajustat el dividend del ${exDate}`);
  }
  await upsertNavs(before.map(p => ({ ...p, nav: Math.round(p.nav * factor * 1e6) / 1e6 })));
  return 'applied';
}

async function updateOne(
  src: FeedSource, ctx: FeedContext, last: NavPoint | undefined, rates: () => Promise<Map<string, number>>,
): Promise<{ update: FundUpdate; latest?: NavPoint }> {
  const name = lookupIsin(src.isin)?.name ?? last?.name ?? src.isin;
  const base = { isin: src.isin, name, source: PROVIDER_LABEL[src.provider], added: 0, lastDate: last?.date ?? null };
  const after = last?.date ?? '0000-00-00';
  try {
    const feed = await fetchFeed(src, ctx);
    let pts = feed.points.filter(p => p.date > after);
    const storedCurrency = last?.currency ?? 'EUR';
    // USD → EUR amb el canvi del BCE (com a l'històric)
    if (pts.some(p => p.currency !== storedCurrency)) {
      if (storedCurrency !== 'EUR' || pts.some(p => p.currency !== 'USD' && p.currency !== 'EUR')) {
        throw new Error(`la font dona preus en ${pts.find(p => p.currency !== storedCurrency)!.currency} i a l'app el fons és en ${storedCurrency}`);
      }
      const r = await rates();
      const conv = pts.map(p => p.currency === 'USD' ? usdToEur(p, r) : p);
      if (conv.some(p => !p)) throw new Error('falta el canvi del BCE per passar el preu de dòlars a euros');
      pts = conv as FeedPoint[];
    }
    // Control de qualitat 1: el preu de la font el dia de l'últim preu desat ha de
    // coincidir amb el desat (mateixa classe i moneda). Si no, no es desa res.
    if (last) {
      const same = feed.points.find(p => p.date === last.date);
      if (same) {
        let v: FeedPoint | null = same;
        if (same.currency !== storedCurrency && same.currency === 'USD' && storedCurrency === 'EUR') v = usdToEur(same, await rates());
        if (v && Math.abs(v.nav / last.nav - 1) > MATCH_TOLERANCE) {
          throw new Error(`el preu de la font del ${last.date} (${v.nav} ${v.currency}) no coincideix amb el desat (${last.nav} ${storedCurrency}); pot ser una altra classe del fons`);
        }
      }
    }
    // Control de qualitat 2: un salt de més del 15 % d'un dia per l'altre no es desa
    let prev = last?.nav;
    for (const p of pts) {
      if (prev && Math.abs(p.nav / prev - 1) > MAX_DAILY_JUMP) {
        const factors = src.adjustDistributions ? distributionFactors(feed.distributions ?? [], feed.points, after) : [];
        if (!factors.length) throw new Error(`el preu del ${p.date} (${p.nav}) canvia més d'un ${MAX_DAILY_JUMP * 100} % respecte de l'anterior (${prev}); no s'ha desat`);
      }
      prev = p.nav;
    }
    if (!pts.length) {
      const latestSeen = feed.points.at(-1)?.date ?? last?.date ?? null;
      const stale = !latestSeen || workdaysAfter(latestSeen, ctx.today) > STALE_WORKDAYS;
      return { update: { ...base, status: stale ? 'stale' : 'up_to_date',
        ...(stale ? { message: latestSeen ? `la gestora encara no ha publicat preus posteriors al ${latestSeen}` : 'la font no ha retornat cap preu' } : {}) } };
    }
    // Classes de distribució: ajustar l'històric pels dividends nous
    if (src.adjustDistributions && last) {
      // Preus sense ajustar de la font, en la moneda desada (per saber si ja s'ha ajustat)
      const r = feed.points.some(p => p.currency === 'USD' && storedCurrency === 'EUR') ? await rates() : null;
      const rawStored = new Map<string, number>();
      for (const p of feed.points) {
        const v = p.currency === storedCurrency ? p : (r && p.currency === 'USD' ? usdToEur(p, r) : null);
        if (v) rawStored.set(p.date, v.nav);
      }
      for (const f of distributionFactors(feed.distributions ?? [], feed.points, after)) {
        await applyDistributionAdjustment(src.isin, f.exDate, f.factor, rawStored);
        pts = pts.map(p => p.date < f.exDate ? { ...p, nav: Math.round(p.nav * f.factor * 1e6) / 1e6 } : p);
      }
    }
    const rows: NavPoint[] = pts.map(p => ({ isin: src.isin, date: p.date, nav: p.nav, currency: p.currency, name }));
    await upsertNavs(rows);
    const latest = rows.at(-1)!;
    const stale = workdaysAfter(latest.date, ctx.today) > STALE_WORKDAYS;
    return {
      update: { ...base, status: stale ? 'stale' : 'updated', added: rows.length, lastDate: latest.date,
        ...(stale ? { message: `l'últim preu publicat és del ${latest.date}` } : {}) },
      latest,
    };
  } catch (err) {
    return { update: { ...base, status: 'failed', message: err instanceof Error ? err.message : String(err) } };
  }
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

/** Executa l'actualització de tots els fons. */
export async function runNavAutoUpdate(trigger: 'cron' | 'admin', opts: { fetchFn?: typeof fetch; now?: Date } = {}): Promise<AutoUpdateSummary> {
  const startedAt = (opts.now ?? new Date()).toISOString();
  const today = madridToday(opts.now);
  const stored = await lastStored();
  const ctx: FeedContext = { since: addDays(today, -LOOKBACK_DAYS), today, fetchFn: opts.fetchFn };
  // Canvis del BCE des del primer dia que pot fer falta (el fons més endarrerit), amb marge
  const earliest = [...stored.values()].reduce((m, p) => (p.date < m ? p.date : m), ctx.since);
  let ratesP: Promise<Map<string, number>> | null = null;
  const rates = () => (ratesP ??= ecbUsdRates(ctx, addDays(earliest < ctx.since ? earliest : ctx.since, -10)));

  // Fons a actualitzar: els que tenen font i ja tenen l'històric carregat (un fons
  // nou s'ha de carregar primer amb l'històric complet des de «Preus dels fons»).
  const results = await pool(NAV_SOURCES.filter(src => stored.has(src.isin)), CONCURRENCY, src => {
    const last = stored.get(src.isin);
    const c = { ...ctx, since: last ? (last.date < ctx.since ? last.date : ctx.since) : ctx.since };
    return updateOne(src, c, last, rates);
  });
  const funds = results.map(r => r.update);

  // Fons amb preus a l'app sense font automàtica: cal entrar-los a mà
  const auto = new Set(NAV_SOURCES.map(s => s.isin));
  for (const [isin, last] of stored) {
    if (auto.has(isin)) continue;
    const behind = workdaysAfter(last.date, today);
    funds.push({
      isin, name: lookupIsin(isin)?.name ?? last.name ?? isin, status: 'manual', source: 'entrada a mà', added: 0,
      lastDate: last.date,
      message: `${MANUAL_ONLY[isin] ?? 'no hi ha cap font automàtica per a aquest fons'}${behind > STALE_WORKDAYS ? ` (últim preu: ${last.date})` : ''}`,
    });
  }

  const latest = results.map(r => r.latest).filter((x): x is NavPoint => !!x);
  const holdingsUpdated = latest.length
    ? await syncHoldingsToNavs(latest.map(l => ({ isin: l.isin, date: l.date, nav: l.nav, currency: l.currency }))).catch(err => {
        console.error('[navAutoUpdate] no s\'han pogut actualitzar les posicions:', err instanceof Error ? err.message : err);
        return 0;
      })
    : 0;

  const counts = { updated: 0, up_to_date: 0, stale: 0, failed: 0, manual: 0 } as Record<FundUpdateStatus, number>;
  for (const f of funds) counts[f.status]++;
  const summary: AutoUpdateSummary = { startedAt, finishedAt: new Date().toISOString(), trigger, today, funds, counts, holdingsUpdated };

  for (const f of funds) {
    console.log(`[navAutoUpdate] ${f.status.padEnd(10)} ${f.isin} ${f.source} +${f.added} ${f.lastDate ?? '-'} ${f.message ?? ''}`);
  }
  await logAuditEventAndWait('fund.navs_auto_update', { resource: 'fund_navs', metadata: summary as unknown as Record<string, unknown> });
  return summary;
}

/** Resum de l'última execució (per a l'admin), o null si encara no n'hi ha cap. */
export async function lastAutoUpdate(): Promise<AutoUpdateSummary | null> {
  const [e] = await getAuditLog({ action: 'fund.navs_auto_update', limit: 1 });
  return e ? (e.metadata as unknown as AutoUpdateSummary) : null;
}

/** Evita execucions repetides: true si n'hi ha hagut una fa menys de `minutes` minuts. */
export async function ranRecently(minutes: number, now = new Date()): Promise<boolean> {
  if (!getDb()) return false;
  const last = await lastAutoUpdate();
  return !!last && now.getTime() - new Date(last.startedAt).getTime() < minutes * 60_000;
}

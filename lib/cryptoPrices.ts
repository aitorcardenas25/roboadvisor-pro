// lib/cryptoPrices.ts — preu diari del bitcoin en euros (BTC/EUR).
//
// Per què així:
//  - El bitcoin no té un "valor liquidatiu oficial" com un fons: cotitza 24 h,
//    cada dia, a molts mercats. Es fa servir el TANCAMENT DIARI (00:00 UTC) d'un
//    exchange europeu regulat amb mercat directe en euros.
//  - Font principal: Kraken (api.kraken.com, OHLC diari XBT/EUR, últims ~720 dies).
//  - Reserva: CoinGecko (mitjana de molts mercats) si Kraken falla.
//  - Històric complet (des de l'abril del 2016): Bitstamp (OHLC diari btceur, amb pàgines),
//    només la primera vegada o si falta història.
//  - Mai s'inventa un preu: si totes les fonts fallen, es queda l'últim desat amb
//    la seva data, i la pantalla ho diu.
//  - Només és per VALORAR el que el client declara. El bitcoin no és a l'univers
//    de fons ni a l'editor de propostes: l'app no el recomana.

import { getDb } from './supabase';

export interface CryptoPoint { date: string; close: number }
export type CryptoSource = 'kraken' | 'bitstamp' | 'coingecko';
export const CRYPTO_SOURCE_LABEL: Record<CryptoSource, string> = {
  kraken: 'Kraken', bitstamp: 'Bitstamp', coingecko: 'CoinGecko',
};

const SYMBOL = 'BTC';
const TIMEOUT_MS = 20_000;
/** Primer dia amb preu BTC/EUR a Bitstamp (comprovat el 26/11/2026). */
export const BTC_HISTORY_START = '2016-04-16';
/** Diferència màxima acceptada entre la font i el preu desat el mateix dia (exchanges diferents, ~0,1–0,5 %). */
const MATCH_TOLERANCE = 0.03;
/** Variació diària màxima acceptada (el bitcoin pot moure's un 20 %; un 60 % seria una dada errònia). */
const MAX_DAILY_JUMP = 0.6;

const isoDay = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const sane = (n: number) => Number.isFinite(n) && n > 1 && n < 100_000_000;

// ─── Lectura de les fonts (funcions pures per als tests) ─────────────────────

/** Només dies tancats: el dia d'avui (UTC) encara cotitza i no té tancament. */
function closedOnly(points: CryptoPoint[], todayUtc: string): CryptoPoint[] {
  const by = new Map<string, number>();
  for (const p of points) if (p.date < todayUtc && sane(p.close)) by.set(p.date, Math.round(p.close * 100) / 100);
  return [...by.entries()].map(([date, close]) => ({ date, close })).sort((a, b) => a.date.localeCompare(b.date));
}

/** Kraken /0/public/OHLC?pair=XBTEUR&interval=1440 → [time, open, high, low, close, vwap, volume, count]. */
export function parseKraken(json: unknown, todayUtc: string): CryptoPoint[] {
  const j = json as { error?: string[]; result?: Record<string, unknown> };
  if (j?.error?.length) throw new Error(`Kraken: ${j.error.join(', ')}`);
  const rows = Object.entries(j?.result ?? {}).find(([k, v]) => k !== 'last' && Array.isArray(v))?.[1] as unknown[][] | undefined;
  if (!rows) throw new Error('Kraken: resposta sense preus');
  return closedOnly(rows.map(r => ({ date: isoDay(Number(r[0])), close: Number(r[4]) })), todayUtc);
}

/** Bitstamp /api/v2/ohlc/btceur/?step=86400 → data.ohlc[{ timestamp, close }]. */
export function parseBitstamp(json: unknown, todayUtc: string): CryptoPoint[] {
  const rows = (json as { data?: { ohlc?: { timestamp: string; close: string }[] } })?.data?.ohlc;
  if (!Array.isArray(rows)) throw new Error('Bitstamp: resposta sense preus');
  return closedOnly(rows.map(r => ({ date: isoDay(Number(r.timestamp)), close: Number(r.close) })), todayUtc);
}

/**
 * CoinGecko /coins/bitcoin/market_chart?vs_currency=eur&days=N&interval=daily →
 * prices[[ms, preu]]. El punt de les 00:00 UTC del dia D és el tancament del dia D−1.
 */
export function parseCoinGecko(json: unknown, todayUtc: string): CryptoPoint[] {
  const rows = (json as { prices?: [number, number][] })?.prices;
  if (!Array.isArray(rows)) throw new Error('CoinGecko: resposta sense preus');
  const pts = rows
    .filter(([ms]) => new Date(ms).getUTCHours() === 0 && new Date(ms).getUTCMinutes() < 30)
    .map(([ms, v]) => ({ date: addDays(new Date(ms).toISOString().slice(0, 10), -1), close: Number(v) }));
  return closedOnly(pts, todayUtc);
}

type FetchFn = typeof fetch;

async function getJson(url: string, fetchFn: FetchFn): Promise<unknown> {
  const r = await fetchFn(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetchKraken(fetchFn: FetchFn, todayUtc: string): Promise<CryptoPoint[]> {
  return parseKraken(await getJson('https://api.kraken.com/0/public/OHLC?pair=XBTEUR&interval=1440', fetchFn), todayUtc);
}

export async function fetchCoinGecko(fetchFn: FetchFn, todayUtc: string, days = 30): Promise<CryptoPoint[]> {
  return parseCoinGecko(await getJson(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=eur&days=${days}&interval=daily`, fetchFn), todayUtc);
}

/**
 * Històric complet de Bitstamp, en pàgines de 1.000 dies cap enrere. L'API
 * retorna els 1.000 dies anteriors a `end` (amb `start` sol, no retorna res
 * de fa anys). Les dades BTC/EUR comencen el 16/04/2016.
 */
export async function fetchBitstampHistory(fetchFn: FetchFn, todayUtc: string, from = BTC_HISTORY_START): Promise<CryptoPoint[]> {
  const out: CryptoPoint[] = [];
  let end = Math.floor(Date.parse(`${todayUtc}T00:00:00Z`) / 1000);
  for (let page = 0; page < 10; page++) {
    const pts = parseBitstamp(await getJson(`https://www.bitstamp.net/api/v2/ohlc/btceur/?step=86400&limit=1000&end=${end}`, fetchFn), todayUtc);
    if (!pts.length) break;
    out.push(...pts);
    const first = pts[0].date;
    if (first <= from) break;
    const nextEnd = Math.floor(Date.parse(`${addDays(first, -1)}T00:00:00Z`) / 1000);
    if (nextEnd >= end) break;
    end = nextEnd;
  }
  return closedOnly(out.filter(p => p.date >= from), todayUtc);
}

// ─── Persistència (taula crypto_prices) ─────────────────────────────────────

const _mem = new Map<string, CryptoPoint>();   // sense Supabase (desenvolupament local)
const PAGE = 1000;

/** Tots els tancaments desats del bitcoin, del més antic al més recent. */
export async function getBtcSeries(): Promise<CryptoPoint[]> {
  const db = getDb();
  if (!db) return [..._mem.values()].sort((a, b) => a.date.localeCompare(b.date));
  const out: CryptoPoint[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('crypto_prices').select('price_date,close_eur')
      .eq('symbol', SYMBOL).order('price_date').range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []).map(r => ({ date: String(r.price_date).slice(0, 10), close: Number(r.close_eur) })));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function getLatestBtc(): Promise<(CryptoPoint & { source: string }) | null> {
  const db = getDb();
  if (!db) { const p = [..._mem.values()].sort((a, b) => a.date.localeCompare(b.date)).at(-1); return p ? { ...p, source: 'kraken' } : null; }
  const { data, error } = await db.from('crypto_prices').select('price_date,close_eur,source')
    .eq('symbol', SYMBOL).order('price_date', { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  const r = data?.[0];
  return r ? { date: String(r.price_date).slice(0, 10), close: Number(r.close_eur), source: String(r.source) } : null;
}

async function countBtc(): Promise<number> {
  const db = getDb();
  if (!db) return _mem.size;
  const { count, error } = await db.from('crypto_prices').select('price_date', { count: 'exact', head: true }).eq('symbol', SYMBOL);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function upsertBtc(points: CryptoPoint[], source: CryptoSource): Promise<number> {
  if (!points.length) return 0;
  const db = getDb();
  if (!db) { for (const p of points) _mem.set(p.date, p); return points.length; }
  const now = new Date().toISOString();
  for (let i = 0; i < points.length; i += 500) {
    const chunk = points.slice(i, i + 500).map(p => ({ symbol: SYMBOL, price_date: p.date, close_eur: p.close, source, updated_at: now }));
    const { error } = await db.from('crypto_prices').upsert(chunk, { onConflict: 'symbol,price_date' });
    if (error) throw new Error(error.message);
  }
  return points.length;
}

/** Per als tests. */
export function _resetMemory() { _mem.clear(); }

// ─── Actualització diària (dins la tasca de les 13:00) ───────────────────────

export interface CryptoUpdate {
  symbol:   'BTC';
  status:   'updated' | 'up_to_date' | 'failed';
  source:   string;
  added:    number;
  lastDate: string | null;
  message?: string;
}

/**
 * Comprova que els preus nous encaixen amb els desats: el mateix dia no pot
 * diferir més d'un 3 % (fonts diferents) i cap dia pot saltar més d'un 60 %.
 */
export function checkContinuity(ref: CryptoPoint | null, fresh: CryptoPoint[]): string | null {
  if (ref) {
    const same = fresh.find(p => p.date === ref.date);
    if (same && Math.abs(same.close / ref.close - 1) > MATCH_TOLERANCE) {
      return `el preu del ${ref.date} no coincideix amb el desat (${same.close} € vs ${ref.close} €)`;
    }
  }
  let prev = ref?.close ?? null;
  for (const p of fresh.filter(x => !ref || x.date > ref.date)) {
    if (prev !== null && Math.abs(p.close / prev - 1) > MAX_DAILY_JUMP) return `salt del preu no creïble el ${p.date}`;
    prev = p.close;
  }
  return null;
}

/**
 * Descarrega els tancaments nous del bitcoin i els desa. La primera vegada
 * (menys de 1.000 dies desats) carrega també l'històric complet de Bitstamp.
 */
export async function updateBtcPrices(opts: { fetchFn?: FetchFn; now?: Date } = {}): Promise<CryptoUpdate> {
  const fetchFn = opts.fetchFn ?? fetch;
  const todayUtc = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const base = { symbol: 'BTC' as const, added: 0 };
  let last: (CryptoPoint & { source: string }) | null = null;
  try {
    last = await getLatestBtc();
    let added = 0;
    const notes: string[] = [];

    // 1) Històric complet, si encara no hi és
    if ((await countBtc()) < 1000) {
      try {
        const hist = await fetchBitstampHistory(fetchFn, todayUtc);
        const problem = checkContinuity(null, hist);
        if (problem) throw new Error(problem);
        added += await upsertBtc(hist, 'bitstamp');
        last = await getLatestBtc();
      } catch (err) {
        notes.push(`històric de Bitstamp no disponible (${err instanceof Error ? err.message : err})`);
      }
    }

    // 2) Últims dies: Kraken; si falla, CoinGecko
    let fresh: CryptoPoint[] = [];
    let source: CryptoSource = 'kraken';
    try {
      fresh = await fetchKraken(fetchFn, todayUtc);
    } catch (err) {
      notes.push(`Kraken ha fallat (${err instanceof Error ? err.message : err})`);
      source = 'coingecko';
      fresh = await fetchCoinGecko(fetchFn, todayUtc);
    }
    const problem = checkContinuity(last, fresh);
    if (problem) throw new Error(`${CRYPTO_SOURCE_LABEL[source]}: ${problem}`);
    const newer = fresh.filter(p => !last || p.date > last.date);
    added += await upsertBtc(newer, source);
    const latest = await getLatestBtc();
    return {
      ...base, status: added > 0 ? 'updated' : 'up_to_date', source: CRYPTO_SOURCE_LABEL[source], added,
      lastDate: latest?.date ?? null, ...(notes.length ? { message: notes.join('; ') } : {}),
    };
  } catch (err) {
    return { ...base, status: 'failed', source: 'Kraken / CoinGecko', lastDate: last?.date ?? null,
      message: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Context de risc per a la pantalla de patrimoni ─────────────────────────

export interface BtcContext {
  price:      number;
  date:       string;
  source:     string;
  /** Variació dels últims 12 mesos, % (null si no hi ha prou història) */
  change1yPct: number | null;
  /** Caiguda màxima des del màxim anterior, en tot l'històric desat, % (negatiu) */
  maxDrawdownPct: number | null;
  maxDrawdownPeak:   string | null;
  maxDrawdownTrough: string | null;
  /** Caiguda actual des del màxim històric, % (0 o negatiu) */
  fromAthPct:  number | null;
  historyFrom: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Variació 12 mesos i caiguda màxima (pic a vall) amb els tancaments diaris. */
export function btcContext(series: CryptoPoint[], source = 'Kraken'): BtcContext | null {
  if (!series.length) return null;
  const last = series.at(-1)!;
  const yearAgo = addDays(last.date, -365);
  const base = [...series].reverse().find(p => p.date <= yearAgo);
  let peak = series[0], worst = 0, wPeak: string | null = null, wTrough: string | null = null;
  for (const p of series) {
    if (p.close > peak.close) peak = p;
    const dd = p.close / peak.close - 1;
    if (dd < worst) { worst = dd; wPeak = peak.date; wTrough = p.date; }
  }
  const ath = Math.max(...series.map(p => p.close));
  return {
    price: last.close, date: last.date, source,
    change1yPct: base ? r2((last.close / base.close - 1) * 100) : null,
    maxDrawdownPct: series.length > 30 ? r2(worst * 100) : null,
    maxDrawdownPeak: wPeak, maxDrawdownTrough: wTrough,
    fromAthPct: r2((last.close / ath - 1) * 100),
    historyFrom: series[0].date,
  };
}

/** Preu i context per a la vista de patrimoni. null si encara no hi ha cap preu desat (o la taula no existeix). */
export async function loadBtcContext(): Promise<BtcContext | null> {
  try {
    const series = await getBtcSeries();
    const latest = series.length ? await getLatestBtc() : null;
    const src = latest ? (CRYPTO_SOURCE_LABEL[latest.source as CryptoSource] ?? latest.source) : 'Kraken';
    return btcContext(series, src);
  } catch (err) {
    console.error('[cryptoPrices] no s\'ha pogut llegir el preu del bitcoin:', err instanceof Error ? err.message : err);
    return null;
  }
}

// lib/fundNavs.ts — persistència dels preus de fons entrats a mà (taula fund_navs).
// Càlculs purs a lib/navMath.ts. Sense Supabase configurat, es guarden en
// memòria (només per a desenvolupament local: es perden en reiniciar).

import ExcelJS from 'exceljs';
import { getDb } from './supabase';
import { ADVISOR_FUNDS, lookupIsin } from './fundUniverse';
import { computeNavMetrics, estimateNavBeta, navPerformance, validMarketSeries, MARKET_PROXY_ISIN, type NavMetrics, type NavPerformance, type NavPoint } from './navMath';

const _mem = new Map<string, NavPoint>();   // clau: isin|date
const key = (isin: string, date: string) => `${isin}|${date}`;
const PAGE = 1000;   // Supabase retorna com a màxim 1.000 files per consulta

function rowToPoint(r: Record<string, unknown>): NavPoint {
  return {
    isin: String(r.isin), date: String(r.nav_date).slice(0, 10), nav: Number(r.nav),
    currency: String(r.currency ?? 'EUR'), ...(r.fund_name ? { name: String(r.fund_name) } : {}),
  };
}

/** Tots els preus (d'un fons o de tots), ordenats per ISIN i data. */
export async function getNavs(isin?: string): Promise<NavPoint[]> {
  const db = getDb();
  if (!db) {
    return [..._mem.values()].filter(p => !isin || p.isin === isin)
      .sort((a, b) => a.isin.localeCompare(b.isin) || a.date.localeCompare(b.date));
  }
  const out: NavPoint[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from('fund_navs').select('isin,nav_date,nav,currency,fund_name')
      .order('isin').order('nav_date').range(from, from + PAGE - 1);
    if (isin) q = q.eq('isin', isin);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...(data ?? []).map(r => rowToPoint(r as Record<string, unknown>)));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Moneda ja desada per a cada ISIN (per no barrejar monedes dins un fons). */
async function savedCurrencies(isins: string[]): Promise<Map<string, string>> {
  const db = getDb();
  const out = new Map<string, string>();
  if (!db) {
    for (const p of _mem.values()) if (isins.includes(p.isin)) out.set(p.isin, p.currency);
    return out;
  }
  // Una consulta per ISIN (1 fila): cap límit de files no en pot deixar cap fora.
  await Promise.all(isins.map(async isin => {
    const { data, error } = await db.from('fund_navs').select('currency').eq('isin', isin).limit(1);
    if (error) throw new Error(error.message);
    if (data?.[0]) out.set(isin, String(data[0].currency));
  }));
  return out;
}

/** Errors de moneda respecte del que ja hi ha desat. */
export async function currencyConflicts(rows: NavPoint[]): Promise<string[]> {
  const saved = await savedCurrencies([...new Set(rows.map(r => r.isin))]);
  const msgs = new Set<string>();
  for (const r of rows) {
    const c = saved.get(r.isin);
    if (c && c !== r.currency) msgs.add(`${r.isin} ja té preus en ${c}; ara n'hi ha en ${r.currency}. Un fons ha de tenir una sola moneda.`);
  }
  return [...msgs];
}

/** Desa (o substitueix, si ja hi ha preu aquell dia) els preus. */
export async function upsertNavs(rows: NavPoint[]): Promise<number> {
  if (!rows.length) return 0;
  const db = getDb();
  if (!db) { for (const r of rows) _mem.set(key(r.isin, r.date), { ...r }); return rows.length; }
  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map(r => ({
      isin: r.isin, nav_date: r.date, nav: r.nav, currency: r.currency,
      fund_name: r.name ?? null, updated_at: now,
    }));
    const { error } = await db.from('fund_navs').upsert(chunk, { onConflict: 'isin,nav_date' });
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

/** Esborra un preu (amb data) o tots els d'un fons (sense data). Retorna quants. */
export async function deleteNavs(isin: string, date?: string): Promise<number> {
  const db = getDb();
  if (!db) {
    let n = 0;
    for (const [k, p] of _mem) if (p.isin === isin && (!date || p.date === date)) { _mem.delete(k); n++; }
    return n;
  }
  let q = db.from('fund_navs').delete().eq('isin', isin);
  if (date) q = q.eq('nav_date', date);
  const { data, error } = await q.select('isin');
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

// ─── Resum per fons ───────────────────────────────────────────────────────────

export interface FundNavSummary {
  isin:     string;
  name:     string;
  category: string;
  inList:   boolean;     // és a la llista de fons de l'assessor
  currency: string | null;
  metrics:  NavMetrics;
}

function nameFor(isin: string, points: NavPoint[]): { name: string; category: string; inList: boolean } {
  const known = lookupIsin(isin);
  const typed = [...points].reverse().find(p => p.name)?.name;
  return {
    name: known?.name ?? typed ?? 'Fons sense nom',
    category: known?.category ?? '',
    inList: ADVISOR_FUNDS.some(f => f.isin === isin),
  };
}

function groupByIsin(points: NavPoint[]): Map<string, NavPoint[]> {
  const by = new Map<string, NavPoint[]>();
  for (const p of points) by.set(p.isin, [...(by.get(p.isin) ?? []), p]);
  return by;
}

/** Un fons per fila: els de la llista de l'assessor (encara que no tinguin preus) i qualsevol altre amb preus. */
export async function getNavSummary(asOf = new Date()): Promise<FundNavSummary[]> {
  const by = groupByIsin(await getNavs());
  const isins = [...new Set([...ADVISOR_FUNDS.map(f => f.isin), ...by.keys()])];
  return isins.map(isin => {
    const pts = by.get(isin) ?? [];
    return { isin, ...nameFor(isin, pts), currency: pts.at(-1)?.currency ?? null, metrics: computeNavMetrics(pts, asOf) };
  }).sort((a, b) => Number(b.inList) - Number(a.inList) || a.name.localeCompare(b.name));
}

/** Rendibilitat i volatilitat per ISIN, només dels fons amb prou historial (per a les propostes). */
export async function getNavPerformanceMap(): Promise<Record<string, NavPerformance>> {
  try {
    const out: Record<string, NavPerformance> = {};
    const by = groupByIsin(await getNavs());
    // El proxy de mercat ha de passar la mateixa validació que els fons; si no, no hi ha beta (ni CAPM).
    const rawMarket = by.get(MARKET_PROXY_ISIN) ?? [];
    const market = validMarketSeries(rawMarket);
    for (const [isin, pts] of by) {
      const perf = navPerformance(computeNavMetrics(pts), nameFor(isin, pts).name);
      if (!perf) continue;
      const beta = estimateNavBeta(pts, market);
      out[isin] = beta === null ? perf : { ...perf, beta };
    }
    return out;
  } catch (err) {
    // Si la taula encara no existeix (migració pendent), les propostes funcionen com abans.
    console.error('[fundNavs] no s\'han pogut llegir els preus:', err instanceof Error ? err.message : err);
    return {};
  }
}

// ─── Fitxer Excel / CSV → text ───────────────────────────────────────────────

/** Converteix la primera full d'un .xlsx en línies separades per tabulador (dates com dd/mm/aaaa). */
export async function workbookToText(data: ArrayBuffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets[0];
  if (!ws) return '';
  const lines: string[] = [];
  ws.eachRow({ includeEmpty: false }, row => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, cell => {
      let v: unknown = cell.value;
      if (v && typeof v === 'object' && 'result' in (v as object)) v = (v as { result: unknown }).result;   // fórmula
      if (v && typeof v === 'object' && 'richText' in (v as object)) v = (v as { richText: { text: string }[] }).richText.map(t => t.text).join('');
      if (v instanceof Date) {
        const iso = v.toISOString().slice(0, 10);
        cells.push(`${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`);
      } else if (typeof v === 'number') {
        cells.push(String(v));   // punt decimal: el lector l'entén
      } else {
        cells.push(v == null ? '' : String(v).replace(/[\t\r\n]+/g, ' '));
      }
    });
    lines.push(cells.join('\t'));
  });
  return lines.join('\n');
}

/** Només per a tests. */
export function __resetNavsForTests() { _mem.clear(); }

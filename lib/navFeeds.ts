// lib/navFeeds.ts — descàrrega automàtica dels valors liquidatius oficials.
//
// Cada fons té una font: la web de la seva gestora (les mateixes que es van fer
// servir per carregar l'històric el 17/11/2026, vegeu fons/cobertura-historics.md).
// Aquí només hi ha la lectura de les fonts; desar a la taula fund_navs i avisar
// de les fallades ho fa lib/navAutoUpdate.ts.
//
// Regles:
//  - Només dades oficials de la gestora. Si una font falla, el fons queda
//    marcat com a fallat i l'admin el pot entrar a mà (mai s'inventa un preu).
//  - Els fons que cotitzen en USD es passen a EUR amb el canvi oficial del BCE
//    del mateix dia (o de l'últim dia anterior publicat), com a l'històric.

import { readSheets, type Sheet } from './xlsxLite';

export interface FeedPoint { date: string; nav: number; currency: string }
/** Dividend d'una classe de distribució (per ajustar l'històric el dia que el fons el descompta). */
export interface FeedDistribution { exDate: string; amount: number; currency: string }
export interface FeedResult { points: FeedPoint[]; distributions?: FeedDistribution[] }

export type Provider =
  | 'vanguard' | 'ishares' | 'xtrackers' | 'dws' | 'fidelity' | 'polar' | 'jpm'
  | 'bestinver' | 'magallanes' | 'azvalor' | 'horos' | 'cobas';

export interface FeedSource {
  isin:     string;
  provider: Provider;
  /** Identificador del fons a la web de la gestora (id de producte, slug, etc.). */
  key:      string;
  /** Classe de participació, quan la font en dona diverses (Cobas, Magallanes). */
  shareClass?: string;
  /** Classe de distribució amb l'històric ajustat pels dividends (iShares). */
  adjustDistributions?: boolean;
  /**
   * Moneda real dels preus quan la font n'indica una altra. Els fons indexats
   * D Acc EUR d'iShares diuen "USD" al fitxer, però el preu és el de la classe
   * en euros (coincideix exactament amb l'històric desat).
   */
  currency?: string;
}

/** Nom de la font per als avisos de l'admin. */
export const PROVIDER_LABEL: Record<Provider, string> = {
  vanguard: 'vanguard.co.uk', ishares: 'ishares.com', xtrackers: 'etf.dws.com', dws: 'funds.dws.com',
  fidelity: 'fidelity.lu', polar: 'polarcapitalfunds.com', jpm: 'am.jpmorgan.com', bestinver: 'bestinver.es',
  magallanes: 'magallanesvalue.com', azvalor: 'azvalor.com', horos: 'horosam.com', cobas: 'cobasam.com',
};

const s = (isin: string, provider: Provider, key: string, extra: Partial<FeedSource> = {}): FeedSource => ({ isin, provider, key, ...extra });

/** Fonts oficials de cada fons amb preus a l'app. */
export const NAV_SOURCES: FeedSource[] = [
  // Vanguard (identificador del fons a vanguard.co.uk)
  s('IE00B03HD191', 'vanguard', '9837'), s('IE0032126645', 'vanguard', '9834'), s('IE0007987708', 'vanguard', '9922'),
  s('IE00B42W4L06', 'vanguard', '9159'), s('IE0031786696', 'vanguard', '9229'), s('IE00B18GC888', 'vanguard', '9197'),
  s('IE0007472115', 'vanguard', '9970'), s('IE00BH65QP47', 'vanguard', '9110'), s('IE00BK5BQT80', 'vanguard', '9679'),
  s('IE0008248803', 'vanguard', '9927'), s('IE00B03HCZ61', 'vanguard', '9932'),
  // iShares (identificador de producte a ishares.com)
  s('IE00B4L5Y983', 'ishares', '251882'), s('IE00B4K48X80', 'ishares', '251861'), s('IE00BKM4GZ66', 'ishares', '264659'),
  s('IE00BDBRDM35', 'ishares', '291770'), s('IE00BF4RFH31', 'ishares', '296576'), s('IE00B5BMR087', 'ishares', '253743'),
  s('IE00B6R51Z18', 'ishares', '251909'), s('IE000NFR7C63', 'ishares', '320429'),
  s('IE00BD0NCM55', 'ishares', '287649', { currency: 'EUR' }), s('IE00BYWYCC39', 'ishares', '287635', { currency: 'EUR' }),
  s('IE00B4WXJJ64', 'ishares', '251740', { adjustDistributions: true }),
  s('IE00BJ5JP105', 'ishares', '308904', { adjustDistributions: true }),
  // Xtrackers i DWS
  s('LU0292107991', 'xtrackers', 'LU0292107991'), s('LU0290358497', 'xtrackers', 'LU0290358497'), s('IE000F354Q61', 'xtrackers', 'IE000F354Q61'),
  s('LU0273159177', 'dws', 'lu0273159177'), s('LU0034353002', 'dws', 'lu0034353002'), s('DE0009848119', 'dws', 'de0009848119'),
  s('DE000DWS1U90', 'dws', 'de000dws1u90'),
  // Fidelity
  s('LU1841614867', 'fidelity', 'LU1841614867'), s('LU0353647737', 'fidelity', 'LU0353647737'), s('LU2813189938', 'fidelity', 'LU2813189938'),
  s('LU1627197004', 'fidelity', 'LU1627197004'), s('LU3123374798', 'fidelity', 'LU3123374798'),
  // Polar Capital (identificador del fons; la taula dona totes les classes)
  s('IE00B3VXGD32', 'polar', '62'), s('IE00BM95B621', 'polar', '67'), s('IE00B4468526', 'polar', '67'),
  s('IE00BF0GL436', 'polar', '528'), s('IE00BF0GL329', 'polar', '528'),
  // JPMorgan
  s('LU0329202252', 'jpm', 'LU0329202252'), s('LU0714179727', 'jpm', 'LU0714179727'),
  // Bestinver (productId del fitxer oficial de valors liquidatius)
  s('ES0114673033', 'bestinver', '1'), s('ES0147622031', 'bestinver', '2'), s('ES0114561006', 'bestinver', '3'),
  s('ES0114638036', 'bestinver', '4'), s('ES0114675038', 'bestinver', '7'), s('ES0183091000', 'bestinver', '16'),
  s('ES0183793001', 'bestinver', '20'), s('ES0112763000', 'bestinver', '28'),
  // Magallanes
  s('ES0159201013', 'magallanes', 'iberian', { shareClass: 'M' }), s('ES0159259011', 'magallanes', 'european', { shareClass: 'M' }),
  s('ES0159202011', 'magallanes', 'microcaps', { shareClass: 'B' }),
  // azValor
  s('ES0112611001', 'azvalor', 'international'), s('ES0112616000', 'azvalor', 'iberia'), s('ES0112609005', 'azvalor', 'blue-chips'),
  s('ES0112602000', 'azvalor', 'managers'), s('ES0112601002', 'azvalor', 'capital'),
  // Horos
  s('ES0146309002', 'horos', '5a017ae36ccb761f259a0435'), s('ES0146311008', 'horos', '5acf59f6bf4c77472b24604e'),
  // Cobas (nom del fons a la taula de valors liquidatius)
  s('ES0119199000', 'cobas', 'Cobas Internacional', { shareClass: 'C' }), s('ES0124037005', 'cobas', 'Cobas Selección', { shareClass: 'C' }),
  s('ES0113728002', 'cobas', 'Cobas Grandes Compañías', { shareClass: 'C' }), s('ES0119184002', 'cobas', 'Cobas Iberia', { shareClass: 'C' }),
  s('ES0119207001', 'cobas', 'Cobas Renta'),
];

/**
 * Fons amb preus a l'app que encara no tenen cap font que es pugui llegir des
 * d'un servidor: Pictet (la web bloqueja els servidors) i Amundi (la web no
 * dona l'històric sense el navegador). S'han d'entrar a mà.
 */
export const MANUAL_ONLY: Record<string, string> = {
  LU0625737910: 'am.pictet.com no deixa descarregar els preus des d\'un servidor',
  LU0996182563: 'amundi.es no publica els preus en un fitxer descarregable des d\'un servidor',
  LU0389811885: 'amundi.es no publica els preus en un fitxer descarregable des d\'un servidor',
  LU0996177134: 'amundi.es no publica els preus en un fitxer descarregable des d\'un servidor',
};

// ─── Utilitats ───────────────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const TIMEOUT_MS = 25_000;

export type FetchFn = typeof fetch;

/** Context d'una execució: memòria cau de descàrregues compartides (Polar, Cobas, BCE). */
export interface FeedContext {
  since: string;          // primera data que interessa (aaaa-mm-dd)
  today: string;          // avui a Madrid (aaaa-mm-dd)
  fetchFn?: FetchFn;
  cache?: Map<string, Promise<Buffer>>;
}

async function download(ctx: FeedContext, url: string, init: RequestInit = {}): Promise<Buffer> {
  const key = `${init.method ?? 'GET'} ${url} ${typeof init.body === 'string' ? init.body : ''}`;
  ctx.cache ??= new Map();
  const hit = ctx.cache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const res = await (ctx.fetchFn ?? fetch)(url, {
      ...init,
      headers: { 'user-agent': UA, accept: '*/*', 'accept-language': 'es-ES,es;q=0.9,en;q=0.8', ...(init.headers ?? {}) },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${new URL(url).host} ha respost ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  })();
  ctx.cache.set(key, p);
  p.catch(() => ctx.cache?.delete(key));
  return p;
}
const downloadText = async (ctx: FeedContext, url: string, init?: RequestInit) => (await download(ctx, url, init)).toString('utf8');
const downloadJson = async (ctx: FeedContext, url: string, init?: RequestInit) => JSON.parse(await downloadText(ctx, url, init));

const MONTHS: Record<string, number> = {
  jan: 1, ene: 1, gen: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, ago: 8,
  sep: 9, set: 9, oct: 10, okt: 10, nov: 11, dec: 12, dic: 12, des: 12, dez: 12,
};
const pad = (n: number) => String(n).padStart(2, '0');
const validYmd = (y: number, m: number, d: number) => {
  if (!(y > 1980 && y < 2100 && m >= 1 && m <= 12 && d >= 1)) return null;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate() ? `${y}-${pad(m)}-${pad(d)}` : null;
};

/** Data d'una cel·la: número de sèrie d'Excel, aaaa-mm-dd, dd/mm/aaaa, dd.mm.aaaa, dd-Mon-aaaa o ms des de 1970. */
export function parseFeedDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' || /^\d+(\.\d+)?$/.test(String(raw).trim())) {
    const n = Number(raw);
    if (n > 20_000 && n < 80_000) {   // sèrie d'Excel (1954–2119)
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86_400_000);
      return d.toISOString().slice(0, 10);
    }
    if (n > 3e11 && n < 5e12) return new Date(n).toISOString().slice(0, 10);   // ms
    if (/^\d{8}$/.test(String(raw).trim())) { const t = String(raw).trim(); return validYmd(+t.slice(0, 4), +t.slice(4, 6), +t.slice(6, 8)); }
    return null;
  }
  const t = String(raw).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return validYmd(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  if (m) return validYmd(+m[3], +m[2], +m[1]);
  m = t.match(/^(\d{1,2})[\s/.\-]([A-Za-zé]{3,9})\.?[\s/.\-](\d{4})/);
  if (m) { const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; return mo ? validYmd(+m[3], mo, +m[1]) : null; }
  m = t.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) { const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]; return mo ? validYmd(+m[3], mo, +m[2]) : null; }
  return null;
}

/** Número d'una cel·la: "62,31", "1.234,56", "289,598 €", "137.339579". */
export function parseFeedNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw === null || raw === undefined) return null;
  let t = String(raw).replace(/[^\d.,\-]/g, '');
  if (!t || !/\d/.test(t)) return null;
  const lastComma = t.lastIndexOf(','), lastDot = t.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    t = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (lastComma > -1) {
    t = (t.match(/,/g)!.length > 1) ? t.replace(/,/g, '') : t.replace(',', '.');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const DATE_HEADER = /^(fecha|date|as of|datum|data|nav date|fecha (de )?valor|valuation date|day|día)\b/i;

/**
 * Sèrie de preus d'un full: busca la fila de capçalera amb una columna de data
 * i una de preu (segons `navHeader`) i llegeix les files de sota.
 */
export function seriesFromSheet(sheet: Sheet, navHeader: RegExp, defaultCurrency: string, currencyHeader = /^(currency|moneda|divisa|währung)$/i): FeedPoint[] {
  const rows = sheet.rows;
  for (let h = 0; h < Math.min(rows.length, 40); h++) {
    const dateIdx = rows[h].findIndex(c => DATE_HEADER.test(c));
    const navIdx  = rows[h].findIndex(c => navHeader.test(c));
    if (dateIdx < 0 || navIdx < 0) continue;
    const curIdx = rows[h].findIndex(c => currencyHeader.test(c));
    const out: FeedPoint[] = [];
    for (const r of rows.slice(h + 1)) {
      const date = parseFeedDate(r[dateIdx]);
      const nav  = parseFeedNumber(r[navIdx]);
      if (!date || nav === null || nav <= 0) continue;
      const cur = curIdx >= 0 && /^[A-Z]{3}$/.test(r[curIdx] ?? '') ? r[curIdx] : defaultCurrency;
      out.push({ date, nav, currency: cur });
    }
    if (out.length) return out;
  }
  return [];
}

function firstSeries(sheets: Sheet[], navHeader: RegExp, defaultCurrency: string): FeedPoint[] {
  for (const sh of sheets) { const pts = seriesFromSheet(sh, navHeader, defaultCurrency); if (pts.length) return pts; }
  return [];
}

const keepSince = (pts: FeedPoint[], ctx: FeedContext) => {
  const byDate = new Map<string, FeedPoint>();
  for (const p of pts) if (p.date >= ctx.since && p.date <= ctx.today) byDate.set(p.date, p);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
};

/** Dies laborables (dl-dv) entre dues dates, inclosos, en ordre. */
export function weekdaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ─── Fonts ───────────────────────────────────────────────────────────────────

async function vanguard(src: FeedSource, ctx: FeedContext): Promise<FeedResult> {
  const query = 'query PriceDetailsQuery($portIds:[String!]!,$startDate:String!,$endDate:String!,$limit:Float){funds(portIds:$portIds){pricingDetails{navPrices(startDate:$startDate,endDate:$endDate,limit:$limit){items{price asOfDate currencyCode}}}}}';
  const body = JSON.stringify({ query, variables: { portIds: [src.key], startDate: ctx.since, endDate: ctx.today, limit: 0 } });
  const j = await downloadJson(ctx, 'https://www.vanguard.co.uk/gpx/graphql', {
    method: 'POST', body, headers: { 'content-type': 'application/json', 'apollographql-client-name': 'gpx', 'x-consumer-id': 'uk0' },
  });
  const items: { price: number; asOfDate: string; currencyCode: string }[] = j?.data?.funds?.[0]?.pricingDetails?.navPrices?.items ?? [];
  return { points: items.map(i => ({ date: String(i.asOfDate).slice(0, 10), nav: Number(i.price), currency: i.currencyCode || 'EUR' })) };
}

async function ishares(src: FeedSource, ctx: FeedContext): Promise<FeedResult> {
  const base = 'https://www.ishares.com/ch/individual/en/products';
  let buf = await download(ctx, `${base}/${src.key}/x/1535604580403.ajax?fileType=xls&fileName=fund&dataType=fund`).catch(() => null);
  if (!buf || !/<(?:\w+:)?Workbook\b/.test(buf.subarray(0, 4000).toString('utf8'))) {
    // L'adreça del fitxer pot canviar: la busquem a la fitxa del producte.
    const page = await downloadText(ctx, `${base}/${src.key}/x`);
    const link = page.match(/[^"'\s]*\.ajax\?fileType=xls[^"'\s]*/)?.[0];
    if (!link) throw new Error('ishares.com: no s\'ha trobat l\'enllaç de descàrrega');
    buf = await download(ctx, new URL(link.replace(/&amp;/g, '&'), 'https://www.ishares.com').href);
  }
  // L'XML d'iShares de vegades porta '&' sense escapar
  const sheets = readSheets(Buffer.from(buf.toString('utf8').replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, '&amp;')));
  const hist = sheets.find(sh => /^historical$/i.test(sh.name));
  if (!hist) throw new Error('ishares.com: el fitxer no té la fulla "Historical"');
  const points = seriesFromSheet(hist, /^nav per share$/i, 'USD');
  let distributions: FeedDistribution[] | undefined;
  if (src.adjustDistributions) {
    const dist = sheets.find(sh => /distribution/i.test(sh.name));
    distributions = [];
    if (dist) {
      for (let h = 0; h < Math.min(dist.rows.length, 20); h++) {
        const ex = dist.rows[h].findIndex(c => /ex[\s-]?date/i.test(c));
        const amt = dist.rows[h].findIndex(c => /total distribution/i.test(c));
        if (ex < 0 || amt < 0) continue;
        const cur = dist.rows[h].findIndex(c => /^currency$/i.test(c));
        for (const r of dist.rows.slice(h + 1)) {
          const exDate = parseFeedDate(r[ex]); const amount = parseFeedNumber(r[amt]);
          if (exDate && amount && amount > 0) distributions.push({ exDate, amount, currency: cur >= 0 && r[cur] ? r[cur] : (points[0]?.currency ?? 'USD') });
        }
        break;
      }
    }
  }
  return { points, distributions };
}

async function xtrackers(src: FeedSource, ctx: FeedContext): Promise<FeedResult> {
  const url = `https://etf.dws.com/api/pdp/es-es/etf/${src.key}/historicaldata/download?startDate=${ctx.since}&endDate=${ctx.today}&includeTax=true`;
  const sheets = readSheets(await download(ctx, url));
  // La moneda va a la capçalera del fitxer: ["Currency", "USD"]
  const meta = sheets[0]?.rows.find(r => /^(currency|moneda|divisa)$/i.test(r[0] ?? '') && /^[A-Z]{3}$/.test(r[1] ?? ''));
  return { points: firstSeries(sheets, /^(nav|valor liquidativo|net asset value|vl)\b/i, meta?.[1] ?? 'EUR') };
}

async function dws(src: FeedSource, ctx: FeedContext): Promise<FeedResult> {
  const pdp = await downloadText(ctx, `https://funds.deutsche-am.com/api/ProductDetailPage/ActiveEmea/es-es/${src.key}`);
  const guid = pdp.match(/"instrumentListingGuid":"([0-9a-f-]{36})"/i)?.[1];
  if (!guid) throw new Error('funds.dws.com: no s\'ha trobat el fons');
  // Fitxer oficial "Fecha;Valor liquidatiu" (dd/mm/aaaa; decimals amb coma)
  const csv = await downloadText(ctx, `https://funds.deutsche-am.com/api/chart-data/ActiveEmea/es-ES/DownloadNavFile/${guid}?startDate=${ctx.since}&endDate=${ctx.today}`);
  const rows = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/).map(l => l.split(';').map(c => c.trim()));
  return { points: seriesFromSheet({ name: 'csv', rows }, /^valor liquidativo/i, 'EUR') };
}

async function fidelity(src: FeedSource, ctx: FeedContext): Promise<FeedResult> {
  const url = `https://www.fidelity.lu/api/ce/fdh/HistoricalNav.xlsx?id=${src.key}&countries=lu&country=lu&languages=en&language=en&channels=ce.private-investor&channel=ce.private-investor&r=${Date.now()}`;
  const sheets = readSheets(await download(ctx, url));
  return { points: firstSeries(sheets, /^(nav|price|net asset value)\b/i, 'EUR') };
}

async function polar(src: FeedSource, ctx: FeedContext): Promise<FeedResult> {
  // La taula dona el preu d'un dia per a totes les classes del fons: en demanem
  // els últims dies laborables (la mateixa resposta serveix per a totes les classes).
  const days = weekdaysBetween(ctx.since, ctx.today).slice(-10);
  const out: FeedPoint[] = [];
  for (const day of days) {
    const [y, m, d] = day.split('-').map(Number);
    const url = `https://www.polarcapitalfunds.com/srp/api/part?id=11938&version=live&route=2493&audience=344&price_part_day=${d}&price_part_month=${m}&price_part_year=${y}&fund_id=${src.key}`;
    const html = await downloadText(ctx, url);
    for (const row of html.split(/<tr\b/i).slice(1)) {
      const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      if (!cells.includes(src.isin)) continue;
      const date = cells.map(parseFeedDate).find(Boolean);
      const cur = cells.find(c => /\b(EUR|USD|GBP)\b/.test(c))?.match(/\b(EUR|USD|GBP)\b/)?.[1] ?? 'EUR';
      // El preu és el primer número després de la columna de classe
      const nums = cells.filter(c => /^-?[\d.,]+$/.test(c)).map(parseFeedNumber).filter((n): n is number => n !== null);
      if (date && nums.length && nums[0] > 0) out.push({ date, nav: nums[0], currency: cur });
    }
  }
  return { points: out };
}

async function jpm(src: FeedSource, ctx: FeedContext): Promise<FeedResult> {
  const j = await downloadJson(ctx, `https://am.jpmorgan.com/FundsMarketingHandler/historicalData?cusip=${src.key}&country=es&role=per&language=es`);
  const list: { date: string; navPrice: number | null; currencyCode?: string; currency?: string }[] = j?.historicalNAVList ?? [];
  return { points: list.filter(x => x.navPrice).map(x => ({ date: String(x.date).slice(0, 10), nav: Number(x.navPrice), currency: x.currencyCode ?? x.currency ?? 'EUR' })) };
}

async function bestinver(src: FeedSource, ctx: FeedContext): Promise<FeedResult> {
  const sheets = readSheets(await download(ctx, `https://www.bestinver.es/WS/Api/Profitability/DownloadExcelLiquidity?productId=${src.key}`));
  return { points: firstSeries(sheets, /^(valor liquidativo|vl|v\.l\.|liquidativo|precio|nav)/i, 'EUR') };
}

async function magallanes(src: FeedSource, ctx: FeedContext): Promise<FeedResult> {
  const from = ctx.since.replace(/-/g, ''); const to = ctx.today.replace(/-/g, '');
  const url = `https://www.magallanesvalue.com/wp-content/fund-datasheet/prices.php?fund=${src.key}&classLetter=${src.shareClass}&from=${from}&to=${to}&type=EXCEL`;
  return { points: firstSeries(readSheets(await download(ctx, url)), /^(precio|valor liquidativo)/i, 'EUR') };
}

async function azvalor(src: FeedSource, ctx: FeedContext): Promise<FeedResult> {
  const sheets = readSheets(await download(ctx, `https://areacliente.azvalor.com/api/product/${src.key}/prices`));
  return { points: firstSeries(sheets, /^valor liquidativo/i, 'EUR') };
}

async function horos(src: FeedSource, ctx: FeedContext): Promise<FeedResult> {
  // [{ price, dateAsString: "aaaammdd", date: (la mitjanit de Madrid en UTC, és a dir, el dia anterior) }]
  const j: { price: number; dateAsString?: string; date?: string }[] = await downloadJson(ctx, `https://horosam.com/api/pricesPure_${src.key}.json`);
  if (!Array.isArray(j)) throw new Error('horosam.com: format de preus desconegut');
  return { points: j.map(x => ({ date: parseFeedDate(x.dateAsString ?? '') ?? '', nav: Number(x.price), currency: 'EUR' })).filter(p => p.date && p.nav > 0) };
}

async function cobas(src: FeedSource, ctx: FeedContext): Promise<FeedResult> {
  // La pàgina de valors liquidatius porta les dades de cada classe en un JSON:
  // {"name":"Cobas Internacional FI Clase C", ..., "product_profit_info":{"liquidative_value":"190,207249 €", ..., "liquidative_date":"23-11-2026"}}
  // Només dona l'últim valor publicat (Cobas publica amb 1-2 dies de retard).
  const html = (await downloadText(ctx, 'https://www.cobasam.com/valores-liquidativos/')).replace(/\\"/g, '"').replace(/\\u00([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const norm = (t: string) => t.normalize('NFC');
  const name = norm(`${src.key} FI${src.shareClass ? ` Clase ${src.shareClass}` : ''}`);
  const text = norm(html);
  const at = text.indexOf(`"name":"${name}"`);
  if (at < 0) throw new Error(`cobasam.com: no s'ha trobat "${name}" a la pàgina`);
  const chunk = text.slice(at, at + 1200);
  const nav = parseFeedNumber(chunk.match(/"liquidative_value":"([^"]*)"/)?.[1]);
  const date = parseFeedDate(chunk.match(/"liquidative_date":"([^"]*)"/)?.[1]);
  if (!nav || !date) throw new Error(`cobasam.com: "${name}" no té valor liquidatiu publicat`);
  return { points: [{ date, nav, currency: 'EUR' }] };
}

/**
 * Sèrie d'un JSON de forma desconeguda: busca la llista més llarga de parells
 * [data, valor] o d'objectes amb una clau de data i una de preu.
 */
export function pointsFromJson(json: unknown, currency: string): FeedPoint[] {
  let best: FeedPoint[] = [];
  const consider = (pts: FeedPoint[]) => { if (pts.length > best.length) best = pts; };
  const walk = (v: unknown, depth: number) => {
    if (depth > 8 || v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      if (v.length && Array.isArray(v[0]) && v[0].length >= 2) {
        consider(v.map(p => ({ date: parseFeedDate((p as unknown[])[0]) ?? '', nav: Number((p as unknown[])[1]), currency }))
          .filter(p => p.date && p.nav > 0));
      } else if (v.length && v[0] && typeof v[0] === 'object') {
        const keys = Object.keys(v[0] as object);
        const dk = keys.find(k => /^(date|fecha|x|asOfDate|navDate|d|t|time|timestamp)$/i.test(k));
        const nk = keys.find(k => /^(nav|price|value|valor|vl|y|close|navPrice|p|v)$/i.test(k));
        if (dk && nk) {
          consider(v.map(o => {
            const r = o as Record<string, unknown>;
            return { date: parseFeedDate(r[dk]) ?? '', nav: parseFeedNumber(r[nk]) ?? 0, currency: typeof r.currency === 'string' ? r.currency : currency };
          }).filter(p => p.date && p.nav > 0));
        }
        for (const x of v.slice(0, 3)) walk(x, depth + 1);
      }
      return;
    }
    for (const x of Object.values(v as object)) walk(x, depth + 1);
  };
  walk(json, 0);
  return best;
}

const FETCHERS: Record<Provider, (src: FeedSource, ctx: FeedContext) => Promise<FeedResult>> = {
  vanguard, ishares, xtrackers, dws, fidelity, polar, jpm, bestinver, magallanes, azvalor, horos, cobas,
};

/** Preus oficials d'un fons des de `ctx.since` fins avui (en la moneda de la font). */
export async function fetchFeed(src: FeedSource, ctx: FeedContext): Promise<FeedResult> {
  const res = await FETCHERS[src.provider](src, ctx);
  const points = src.currency ? res.points.map(p => ({ ...p, currency: src.currency! })) : res.points;
  return { ...res, points: keepSince(points, ctx) };
}

// ─── Canvi oficial del BCE ───────────────────────────────────────────────────

/** Dòlars per euro del BCE (data → canvi) entre dues dates. */
export async function ecbUsdRates(ctx: FeedContext, from: string): Promise<Map<string, number>> {
  const csv = await downloadText(ctx, `https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?startPeriod=${from}&endPeriod=${ctx.today}&format=csvdata`);
  const lines = csv.trim().split(/\r?\n/);
  const head = lines[0].split(',');
  const di = head.indexOf('TIME_PERIOD'), vi = head.indexOf('OBS_VALUE');
  const out = new Map<string, number>();
  for (const l of lines.slice(1)) {
    const c = l.split(',');
    const v = Number(c[vi]);
    if (c[di] && v > 0) out.set(c[di], v);
  }
  return out;
}

/** Passa un preu en USD a EUR amb el canvi del mateix dia o, si no n'hi ha, del dia publicat anterior (fins a 7 dies). */
export function usdToEur(p: FeedPoint, rates: Map<string, number>): FeedPoint | null {
  for (let i = 0; i <= 7; i++) {
    const d = new Date(new Date(`${p.date}T00:00:00Z`).getTime() - i * 86_400_000).toISOString().slice(0, 10);
    const r = rates.get(d);
    if (r) return { date: p.date, nav: Math.round((p.nav / r) * 1e6) / 1e6, currency: 'EUR' };
  }
  return null;
}

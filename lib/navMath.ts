// lib/navMath.ts — part pura (sense BD) dels preus de fons entrats a mà.
// Decisió 2026-11-16: durant la beta tancada no es paga cap API de dades. L'admin
// entra el valor liquidatiu (VL / NAV) de cada fons, un cop al mes, des de dades
// públiques (gestora, Morningstar). D'aquí surten rendibilitat, volatilitat i
// caiguda màxima, que fan servir les propostes (lib/proposalMath.ts).
//
// Regla: no s'inventa res. Un mes sense preu no s'interpola: es compta com a
// buit i, si n'hi ha cap dins la finestra, el fons no es fa servir per projectar.

export interface NavPoint {
  isin:     string;
  date:     string;   // yyyy-mm-dd
  nav:      number;   // valor liquidatiu per participació
  currency: string;   // EUR, USD…
  name?:    string;   // nom del fons, si l'admin l'ha escrit
}

/** Anys mínims de preus mensuals seguits perquè les mètriques es facin servir a les propostes. */
export const MIN_YEARS_FOR_PROPOSALS = 3;
/** Finestra màxima de càlcul: els últims 5 anys (60 rendiments mensuals). */
export const MAX_WINDOW_MONTHS = 60;
/**
 * Variació màxima creïble entre dos preus seguits d'un fons UCITS. Per sobre,
 * gairebé sempre és un error en teclejar (una coma de menys, un zero de més)
 * i el fons no es fa servir fins que es corregeix (validació de qualitat,
 * AGENTS.md: cap sèrie arriba als càlculs sense validar).
 */
export const MAX_MOVE_PCT = 40;
/** Dies sense preu nou a partir dels quals es considera desactualitzat. */
export const STALE_DAYS = 45;

// ─── Lectura del text enganxat (Excel, CSV, a mà) ─────────────────────────────

export interface ParseIssue { line: number; message: string }
export interface ParseResult { rows: NavPoint[]; errors: ParseIssue[]; warnings: ParseIssue[] }

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/** ISIN vàlid (ISO 6166, dígit de control Luhn). Còpia de lib/fundUniverse.ts per no dependre del catàleg. */
export function isIsin(raw: string): boolean {
  const isin = raw.trim().toUpperCase();
  if (!ISIN_RE.test(isin)) return false;
  const digits = isin.slice(0, -1).split('').map(c => parseInt(c, 36).toString()).join('');
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return (10 - (sum % 10)) % 10 === Number(isin[isin.length - 1]);
}

/** Data com a yyyy-mm-dd. Accepta dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa, aaaa-mm-dd i aaaa/mm/dd. */
export function parseNavDate(raw: string): string | null {
  const s = raw.trim();
  const build = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
      ? dt.toISOString().slice(0, 10) : null;
  };
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return build(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

/** Número en format europeu ("1.234,56") o anglès ("1234.56"). */
export function parseNavNumber(raw: string): number | null {
  let s = raw.replace(/[€$£\s]/g, '');
  if (!/^-?[\d.,]+$/.test(s)) return null;
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    // Una coma = decimal (els VL europeus: "123,456"); més d'una = milers.
    s = (s.match(/,/g)!.length > 1) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if ((s.match(/\./g)?.length ?? 0) > 1) {
    s = s.replace(/\./g, '');   // "1.234.567"
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitCells(line: string): string[] {
  for (const sep of ['\t', ';']) if (line.includes(sep)) return line.split(sep).map(c => c.trim()).filter(Boolean);
  // Coma com a separador només si cap cel·la resultant sembla una data (si no,
  // la coma és el decimal: "31/01/2024 12,34").
  if (line.includes(',')) {
    const cells = line.split(',').map(c => c.trim()).filter(Boolean);
    if (cells.some(c => parseNavDate(c))) return cells;
  }
  return line.trim().split(/\s+/).filter(Boolean);
}

const CURRENCIES = new Set(['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'SEK', 'NOK', 'DKK', 'CAD', 'AUD']);
const HEADER_RE = /\b(isin|data|date|fecha|nav|vl|valor|preu|precio|price|moneda|currency|divisa|nom|name)\b/i;

/**
 * A una capçalera tipus Date,Open,High,Low,Close,Adj Close,Volume, l'índex de la
 * columna amb el preu a fer servir: tancament ajustat si hi és, si no tancament o NAV.
 */
function priceHeaderColumn(cells: string[]): number | null {
  const norm = cells.map(c => c.toLowerCase().replace(/[^a-z]/g, ''));
  for (const want of ['adjclose', 'adjustedclose', 'nav', 'close']) {
    const i = norm.indexOf(want);
    if (i >= 0) return i;
  }
  return null;
}

/**
 * Llegeix files de preus. Cada línia: ISIN, data, valor liquidatiu i, opcional,
 * moneda i nom, en qualsevol ordre i separats per tabulador (Excel), punt i coma,
 * coma o espais. Si la línia no porta ISIN es fa servir `defaultIsin`.
 */
export function parseNavText(text: string, opts: { defaultIsin?: string; defaultCurrency?: string } = {}): ParseResult {
  const res: ParseResult = { rows: [], errors: [], warnings: [] };
  const defIsin = opts.defaultIsin?.trim().toUpperCase() || undefined;
  const defCur  = (opts.defaultCurrency?.trim().toUpperCase() || 'EUR');
  const seen = new Map<string, number>();
  // Columna del preu quan el fitxer porta capçalera amb diverses columnes de
  // preu (descàrregues de Yahoo, EODHD, Investing: Date,Open,High,Low,Close,
  // Adj Close,Volume). Sense això es llegiria l'obertura en lloc del tancament.
  let priceCol: number | null = null;
  let headerSep = ',';

  text.split(/\r?\n/).forEach((raw, idx) => {
    const line = idx + 1;
    if (!raw.trim()) return;
    const cells = splitCells(raw);
    if (priceCol === null && /(^|[\t;,])\s*open\s*([\t;,]|$)/i.test(raw)) {
      headerSep = raw.includes('\t') ? '\t' : raw.includes(';') ? ';' : ',';
      const col = priceHeaderColumn(raw.split(headerSep).map(c => c.trim()));
      if (col !== null) { priceCol = col; return; }
    }
    let isin: string | undefined, date: string | null = null, nav: number | null = null, currency: string | undefined;
    const words: string[] = [];
    if (priceCol !== null) {
      // Posició exacta: es conserven les cel·les buides perquè la columna no es desplaci.
      const positional = raw.split(headerSep).map(c => c.trim());
      nav = positional[priceCol] ? parseNavNumber(positional[priceCol]) : null;
      for (const c of cells) {
        const up = c.toUpperCase();
        if (!isin && ISIN_RE.test(up)) isin = up;
        else if (!date && parseNavDate(c)) date = parseNavDate(c);
        else if (!currency && CURRENCIES.has(up)) currency = up;
      }
    }
    for (const c of priceCol !== null ? [] : cells) {
      const up = c.toUpperCase();
      if (!isin && ISIN_RE.test(up)) { isin = up; continue; }
      if (!date) { const d = parseNavDate(c); if (d) { date = d; continue; } }
      if (!currency && CURRENCIES.has(up)) { currency = up; continue; }
      if (nav === null) { const n = parseNavNumber(c); if (n !== null) { nav = n; continue; } }
      words.push(c);
    }
    if (!date && nav === null) {
      // Capçalera, línia de text o fila de la plantilla sense omplir
      if (isin && !HEADER_RE.test(raw)) res.warnings.push({ line, message: `${isin}: sense data ni preu, s'ignora` });
      return;
    }
    isin = isin ?? defIsin;
    if (!isin)            { res.errors.push({ line, message: 'Falta l\'ISIN (escriu-lo a la línia o tria el fons a dalt)' }); return; }
    if (!isIsin(isin))    { res.errors.push({ line, message: `ISIN no vàlid: ${isin}` }); return; }
    if (!date)            { res.errors.push({ line, message: 'Falta la data o no s\'entén (fes servir dd/mm/aaaa)' }); return; }
    if (nav === null)     { res.errors.push({ line, message: 'Falta el valor liquidatiu' }); return; }
    if (nav <= 0)         { res.errors.push({ line, message: `El valor liquidatiu ha de ser més gran que 0 (${nav})` }); return; }
    if (date > new Date().toISOString().slice(0, 10)) { res.errors.push({ line, message: `La data ${fmtDate(date)} és futura` }); return; }
    const name = words.filter(w => w.length > 2 && !HEADER_RE.test(w) && parseNavNumber(w) === null).join(' ').slice(0, 200) || undefined;
    const row: NavPoint = { isin, date, nav, currency: currency ?? defCur, ...(name ? { name } : {}) };
    const key = `${isin}|${date}`;
    const prev = seen.get(key);
    if (prev !== undefined) {
      res.warnings.push({ line, message: `${isin} ${fmtDate(date)} surt dues vegades: es queda aquesta línia` });
      res.rows[prev] = row;
      return;
    }
    seen.set(key, res.rows.length);
    res.rows.push(row);
  });

  // Salts sospitosos dins el mateix enganxat (probable error en teclejar)
  const byIsinRows = new Map<string, NavPoint[]>();
  for (const r of res.rows) byIsinRows.set(r.isin, [...(byIsinRows.get(r.isin) ?? []), r]);
  for (const [isin, rows] of byIsinRows) {
    for (const j of suspectMoves(rows)) {
      res.warnings.push({ line: 0, message: `${isin}: el preu passa de ${j.from} a ${j.to} (${j.change > 0 ? '+' : ''}${j.change} %) el ${fmtDate(j.date)}. Comprova'l.` });
    }
  }

  // Moneda única per fons dins el mateix enganxat
  const curByIsin = new Map<string, Set<string>>();
  for (const r of res.rows) curByIsin.set(r.isin, (curByIsin.get(r.isin) ?? new Set()).add(r.currency));
  for (const [isin, set] of curByIsin) {
    if (set.size > 1) res.errors.push({ line: 0, message: `${isin} té preus en monedes diferents (${[...set].join(', ')}). Un fons ha de tenir una sola moneda.` });
  }
  return res;
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Mètriques ────────────────────────────────────────────────────────────────

export interface NavMetrics {
  points:         number;          // preus desats
  firstDate:      string | null;
  lastDate:       string | null;
  lastNav:        number | null;
  windowStart:    string | null;   // primer mes de la finestra de càlcul
  months:         number;          // mesos coberts per la finestra (màx. 60)
  years:          number;
  missingMonths:  string[];        // yyyy-mm sense preu dins la finestra
  annualReturn:   number | null;   // % anual (CAGR) a la finestra
  return1Y:       number | null;   // % últims 12 mesos
  volatility:     number | null;   // % anual
  maxDrawdown:    number | null;   // % (negatiu)
  worst12M:       number | null;   // pitjor rendiment de 12 mesos seguits, %
  suspect:        SuspectMove[];   // salts de més de MAX_MOVE_PCT dins la finestra
  stale:          boolean;         // l'últim preu té més de STALE_DAYS dies
  usable:         boolean;         // es fa servir a les propostes
  reason:         string | null;   // per què no és usable
}

export interface SuspectMove { date: string; from: number; to: number; change: number }

/** Preus seguits amb una variació de més de MAX_MOVE_PCT (%). */
export function suspectMoves(points: Pick<NavPoint, 'date' | 'nav'>[]): SuspectMove[] {
  const sorted = [...points].filter(p => p.nav > 0).sort((a, b) => a.date.localeCompare(b.date));
  const out: SuspectMove[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const ch = (sorted[i].nav / sorted[i - 1].nav - 1) * 100;
    if (Math.abs(ch) > MAX_MOVE_PCT) out.push({ date: sorted[i].date, from: sorted[i - 1].nav, to: sorted[i].nav, change: Math.round(ch * 10) / 10 });
  }
  return out;
}

const ym = (iso: string) => iso.slice(0, 7);
function addMonths(ymStr: string, n: number): string {
  const [y, m] = ymStr.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
function monthDiff(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Últim preu de cada mes natural (yyyy-mm → NAV). */
export function monthEndSeries(points: Pick<NavPoint, 'date' | 'nav'>[]): { month: string; date: string; nav: number }[] {
  const byMonth = new Map<string, { month: string; date: string; nav: number }>();
  for (const p of [...points].sort((a, b) => a.date.localeCompare(b.date))) {
    byMonth.set(ym(p.date), { month: ym(p.date), date: p.date, nav: p.nav });
  }
  return [...byMonth.values()];
}

/**
 * Rendibilitat, risc i caiguda d'un fons a partir dels seus preus.
 *
 * - Rendibilitat anualitzada (CAGR): (VL final / VL inicial)^(12 / mesos) − 1.
 * - Volatilitat: desviació estàndard mostral dels rendiments mensuals × √12
 *   (Markowitz 1952; anualització estàndard de la desviació, Sharpe 1966).
 * - Caiguda màxima (maximum drawdown): pitjor caiguda des d'un màxim previ
 *   (Magdon-Ismail & Atiya 2004), amb tots els preus de la finestra.
 * - Pitjor any: pitjor rendiment de 12 mesos seguits dins la finestra.
 *
 * Finestra: els últims 60 mesos com a màxim. Només es fa servir a les
 * propostes si cobreix com a mínim MIN_YEARS_FOR_PROPOSALS anys sense cap mes buit.
 * Atenció: en classes de distribució (Inc / Dis) el VL baixa quan es paga el
 * dividend; les xifres no l'inclouen.
 */
export function computeNavMetrics(points: Pick<NavPoint, 'date' | 'nav'>[], asOf: Date = new Date()): NavMetrics {
  const sorted = [...points].filter(p => p.nav > 0).sort((a, b) => a.date.localeCompare(b.date));
  const empty: NavMetrics = {
    points: sorted.length, firstDate: sorted[0]?.date ?? null, lastDate: sorted.at(-1)?.date ?? null,
    lastNav: sorted.at(-1)?.nav ?? null, windowStart: null, months: 0, years: 0, missingMonths: [],
    annualReturn: null, return1Y: null, volatility: null, maxDrawdown: null, worst12M: null,
    suspect: [], stale: false, usable: false, reason: 'Encara no hi ha preus',
  };
  if (!sorted.length) return empty;
  const last = sorted.at(-1)!;
  const stale = (asOf.getTime() - new Date(`${last.date}T00:00:00Z`).getTime()) / 86_400_000 > STALE_DAYS;
  if (sorted.length < 2) return { ...empty, stale, reason: 'Només hi ha un preu' };

  const monthly = monthEndSeries(sorted);
  const lastMonth = monthly.at(-1)!.month;
  const startMonth = monthly.find(p => monthDiff(p.month, lastMonth) <= MAX_WINDOW_MONTHS)!.month;
  const win = monthly.filter(p => p.month >= startMonth);
  const months = monthDiff(win[0].month, lastMonth);

  const have = new Set(win.map(p => p.month));
  const missingMonths: string[] = [];
  for (let i = 1; i < months; i++) { const mm = addMonths(win[0].month, i); if (!have.has(mm)) missingMonths.push(mm); }

  // Rendiments mensuals només entre mesos seguits
  const rets: number[] = [];
  for (let i = 1; i < win.length; i++) {
    if (monthDiff(win[i - 1].month, win[i].month) === 1) rets.push(win[i].nav / win[i - 1].nav - 1);
  }

  const annualReturn = months > 0 ? (Math.pow(win.at(-1)!.nav / win[0].nav, 12 / months) - 1) * 100 : null;

  let volatility: number | null = null;
  if (rets.length >= 12) {
    const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
    const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1);
    volatility = Math.sqrt(variance) * Math.sqrt(12) * 100;
  }

  let peak = -Infinity, mdd = 0;
  for (const p of sorted.filter(p => p.date >= win[0].date)) {
    peak = Math.max(peak, p.nav);
    mdd = Math.min(mdd, p.nav / peak - 1);
  }

  const byMonth = new Map(win.map(p => [p.month, p.nav]));
  const ago12 = byMonth.get(addMonths(lastMonth, -12));
  const return1Y = ago12 ? (win.at(-1)!.nav / ago12 - 1) * 100 : null;
  let worst: number | null = null;
  for (const p of win) {
    const before = byMonth.get(addMonths(p.month, -12));
    if (before) { const r = (p.nav / before - 1) * 100; worst = worst === null ? r : Math.min(worst, r); }
  }

  const suspect = suspectMoves(sorted.filter(p => p.date >= win[0].date));
  const minMonths = MIN_YEARS_FOR_PROPOSALS * 12;
  let reason: string | null = null;
  if (suspect.length) reason = `Variació sospitosa del ${suspect[0].change} % el ${fmtDate(suspect[0].date)}: comprova el preu`;
  else if (months < minMonths) reason = `Calen ${MIN_YEARS_FOR_PROPOSALS} anys de preus mensuals; n'hi ha ${(months / 12).toLocaleString('ca-ES', { maximumFractionDigits: 1 })}`;
  else if (missingMonths.length) reason = `Falten preus de ${missingMonths.length} ${missingMonths.length === 1 ? 'mes' : 'mesos'}`;

  return {
    points: sorted.length, firstDate: sorted[0].date, lastDate: last.date, lastNav: last.nav,
    windowStart: win[0].date, months, years: r2(months / 12), missingMonths,
    annualReturn: annualReturn === null ? null : r2(annualReturn),
    return1Y: return1Y === null ? null : r2(return1Y),
    volatility: volatility === null ? null : r2(volatility),
    maxDrawdown: r2(mdd * 100),
    worst12M: worst === null ? null : r2(worst),
    suspect, stale, usable: reason === null && annualReturn !== null && volatility !== null, reason,
  };
}

/** Dades de rendiment per a les propostes, amb la font explicada. */
export interface NavPerformance {
  return5Y: number; volatility: number; source: string; name?: string;
  beta?: number;   // β respecte de l'índex de mercat (CAPM), dels mateixos valors liquidatius
}

// ─── Beta i rendiment esperat (CAPM) ──────────────────────────────────────────

/** Índex de mercat per a la beta: Amundi Index MSCI World (EUR), amb preus oficials a fund_navs. */
export const MARKET_PROXY_ISIN = 'LU0996182563';

/**
 * Hipòtesis del CAPM, Sharpe (1964): E(Ri) = Rf + βi × (E(Rm) − Rf).
 * Rf: tipus de la facilitat de dipòsit del BCE (2,00 % des del 11/06/2025).
 * Prima de risc: prima implícita de mercat madur de Damodaran (gener 2025, 4,33 %).
 * Cal revisar-les un cop l'any (el BCE pot moure el tipus abans).
 */
export const CAPM_ASSUMPTIONS = {
  riskFree: 2.0,
  equityPremium: 4.33,
  source: 'CAPM (Sharpe, 1964): tipus de dipòsit del BCE 2,00 % + β × prima de risc de mercat 4,33 % (Damodaran, gener 2025)',
} as const;

/** Rendiment anual esperat (%) segons el CAPM. */
export function capmReturn(beta: number, a: { riskFree: number; equityPremium: number } = CAPM_ASSUMPTIONS): number {
  return a.riskFree + beta * a.equityPremium;
}

/** Rendiments mensuals (%) per mes "aaaa-mm", amb l'últim preu de cada mes. */
export function monthlyReturnsByMonth(points: Pick<NavPoint, 'date' | 'nav'>[]): Map<string, number> {
  const lastOfMonth = new Map<string, number>();
  for (const p of [...points].filter(p => p.nav > 0).sort((a, b) => a.date.localeCompare(b.date))) lastOfMonth.set(p.date.slice(0, 7), p.nav);
  const months = [...lastOfMonth.keys()].sort();
  const out = new Map<string, number>();
  for (let i = 1; i < months.length; i++) {
    const [py, pm] = months[i - 1].split('-').map(Number), [y, m] = months[i].split('-').map(Number);
    if ((y * 12 + m) - (py * 12 + pm) !== 1) continue;   // mes saltat: no es calcula
    out.set(months[i], (lastOfMonth.get(months[i])! / lastOfMonth.get(months[i - 1])! - 1) * 100);
  }
  return out;
}

/**
 * Beta per MQO (mínims quadrats) dels rendiments mensuals del fons contra el mercat,
 * amb els últims `maxMonths` mesos comuns. Null amb menys de 24 mesos comuns.
 */
export function estimateNavBeta(fund: Pick<NavPoint, 'date' | 'nav'>[], market: Pick<NavPoint, 'date' | 'nav'>[], maxMonths = 60): number | null {
  const f = monthlyReturnsByMonth(fund), m = monthlyReturnsByMonth(market);
  const common = [...f.keys()].filter(k => m.has(k)).sort().slice(-maxMonths);
  if (common.length < 24) return null;
  const xs = common.map(k => m.get(k)!), ys = common.map(k => f.get(k)!);
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let cov = 0, varX = 0;
  for (let i = 0; i < xs.length; i++) { cov += (xs[i] - mx) * (ys[i] - my); varX += (xs[i] - mx) ** 2; }
  return varX > 0 ? Math.round(cov / varX * 100) / 100 : null;
}

export function navPerformance(m: NavMetrics, name?: string): NavPerformance | null {
  if (!m.usable || m.annualReturn === null || m.volatility === null || !m.lastDate) return null;
  const yrs = m.years.toLocaleString('ca-ES', { maximumFractionDigits: 1 });
  return {
    return5Y: m.annualReturn, volatility: m.volatility,
    source: `Valors liquidatius oficials (${yrs} anys, fins al ${fmtDate(m.lastDate)})`,
    ...(name ? { name } : {}),
  };
}

/** Proxy de mercat per a la beta: només si passa la mateixa validació que un fons (salts impossibles, historial curt…). */
export function validMarketSeries<T extends Pick<NavPoint, 'date' | 'nav'>>(points: T[]): T[] {
  return navPerformance(computeNavMetrics(points)) ? points : [];
}

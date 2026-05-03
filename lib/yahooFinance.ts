// lib/yahooFinance.ts
// Servei modular per obtenir dades de mercat.
// Ordre de prioritat: Alpha Vantage (si hi ha clau) → Yahoo v7/v8 → error clar
//
// Per activar la connexió real: afegir ALPHA_VANTAGE_API_KEY al .env.local
// Clau gratuïta (25 req/dia): https://www.alphavantage.co/support/#api-key

import type { OHLCV } from '@/lib/technicalAnalysis';

export interface MarketQuote {
  symbol:        string;
  price:         number;
  change:        number;
  changePercent: number;
  open:          number;
  high:          number;
  low:           number;
  volume:        number;
  currency:      string;
  source:        'alphavantage' | 'yahoo' | 'unavailable';
}

// ─── Shared headers ──────────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const BASE_HEADERS = {
  'User-Agent':      UA,
  'Accept':          'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

// ─── Module-level crumb cache ────────────────────────────────────────────────

let _crumb: { crumb: string; cookie: string; expiry: number } | null = null;

export async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (_crumb && Date.now() < _crumb.expiry) return _crumb;
  try {
    // fc.yahoo.com sets A3 cookie even on 404, bypassing Cloudflare
    const r1 = await fetch('https://fc.yahoo.com', {
      headers: { ...BASE_HEADERS, Accept: 'text/html,application/xhtml+xml,*/*' },
      redirect: 'follow',
    });
    const h = r1.headers as unknown as { getSetCookie?: () => string[] };
    const cookieArr: string[] = typeof h.getSetCookie === 'function'
      ? h.getSetCookie()
      : (r1.headers.get('set-cookie') ?? '').split(/,(?=\s*[A-Za-z_][^=]+=)/).filter(Boolean);
    const cookie = cookieArr.map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
    if (!cookie) return null;

    // Crumb fetch is best-effort — if rate-limited, proceed with cookie only
    const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...BASE_HEADERS, Cookie: cookie },
    });
    const crumbText = r2.ok ? (await r2.text()).trim() : '';
    const crumb = (crumbText && !crumbText.startsWith('<') && crumbText !== 'Unauthorized' && crumbText !== 'Too Many Requests')
      ? crumbText : '';
    _crumb = { crumb, cookie, expiry: Date.now() + 30 * 60 * 1000 };
    return _crumb;
  } catch { return null; }
}

// ─── Alpha Vantage (primary when key available) ───────────────────────────────

async function fetchAlphaVantageOHLCV(symbol: string): Promise<OHLCV[] | null> {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key || key === 'la_teva_clau_real_aqui') return null;

  // Normalize symbol for Alpha Vantage (SAN.MC → SAN.MC, ^IBEX → not supported → skip)
  if (symbol.startsWith('^')) return null; // Indices not supported

  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&outputsize=full&apikey=${key}`;
    const res = await fetch(url, { headers: BASE_HEADERS, cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    if (json['Note'] || json['Information']) return null; // rate limited

    const series = json['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;
    if (!series) return null;

    const candles: OHLCV[] = Object.entries(series)
      .map(([date, v]) => ({
        time:   Math.floor(new Date(date).getTime() / 1000),
        open:   parseFloat(v['1. open']),
        high:   parseFloat(v['2. high']),
        low:    parseFloat(v['3. low']),
        close:  parseFloat(v['5. adjusted close'] ?? v['4. close']),
        volume: parseInt(v['6. volume'] ?? v['5. volume'] ?? '0'),
      }))
      .filter(c => isFinite(c.close) && c.close > 0)
      .sort((a, b) => a.time - b.time)
      .slice(-180); // últims 180 dies

    return candles.length >= 10 ? candles : null;
  } catch { return null; }
}

// ─── Yahoo Finance endpoints ──────────────────────────────────────────────────

function parseYahooChart(result: Record<string, unknown>): OHLCV[] {
  const ts = (result.timestamp as number[]) ?? [];
  const q  = (result.indicators as Record<string, unknown[]>).quote[0] as Record<string, number[]>;
  return ts
    .map((t, i) => ({
      time:   t,
      open:   q.open?.[i],
      high:   q.high?.[i],
      low:    q.low?.[i],
      close:  q.close?.[i],
      volume: q.volume?.[i] ?? 0,
    }))
    .filter(c => c.open != null && c.close != null && isFinite(c.close) && c.close > 0)
    .sort((a, b) => a.time - b.time) as OHLCV[];
}

export async function fetchOHLCV(
  symbol:    string,
  interval:  string = '1d',
  range:     string = '180d',
): Promise<{ candles: OHLCV[]; source: 'alphavantage' | 'yahoo' }> {
  // 1. Alpha Vantage (daily only)
  if (interval === '1d') {
    const av = await fetchAlphaVantageOHLCV(symbol);
    if (av) return { candles: av, source: 'alphavantage' };
  }

  // 2. Yahoo Finance — crumb + cookie
  const crumb = await getYahooCrumb();
  const sym   = encodeURIComponent(symbol);

  const yahooEndpoints = [
    // v8 amb crumb
    ...(crumb ? [`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${range}&crumb=${encodeURIComponent(crumb.crumb)}`] : []),
    // v7 (menys restrictiu)
    `https://query1.finance.yahoo.com/v7/finance/chart/${sym}?interval=${interval}&range=${range}`,
    `https://query2.finance.yahoo.com/v7/finance/chart/${sym}?interval=${interval}&range=${range}`,
    // v8 sense crumb
    `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${range}`,
  ];

  for (const url of yahooEndpoints) {
    try {
      const headers: Record<string, string> = { ...BASE_HEADERS };
      if (crumb?.cookie) headers['Cookie'] = crumb.cookie;
      const res = await fetch(url, { headers, cache: 'no-store' });
      if (res.status === 404) throw new Error(`Símbol no trobat: ${symbol}. Comprova que el ticker és vàlid (ex: AAPL, SAN.MC, ^IBEX).`);
      if (!res.ok) continue;
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result?.timestamp?.length) continue;
      const candles = parseYahooChart(result);
      if (candles.length >= 10) return { candles, source: 'yahoo' };
    } catch (e) {
      if ((e as Error).message.includes('Símbol no trobat')) throw e;
      continue;
    }
  }

  throw new Error(
    `Yahoo Finance no disponible per a "${symbol}". ` +
    `Per a connexió real, afegeix ALPHA_VANTAGE_API_KEY al .env.local (gratuït: alphavantage.co).`
  );
}

// ─── Quote ───────────────────────────────────────────────────────────────────

export async function fetchQuote(symbol: string): Promise<MarketQuote | null> {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (key && key !== 'la_teva_clau_real_aqui') {
    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
      const res  = await fetch(url, { headers: BASE_HEADERS, cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const q    = json['Global Quote'] as Record<string, string> | undefined;
        if (q?.['05. price']) {
          return {
            symbol,
            price:         parseFloat(q['05. price']),
            change:        parseFloat(q['09. change']),
            changePercent: parseFloat((q['10. change percent'] ?? '0').replace('%', '')),
            open:          parseFloat(q['02. open']),
            high:          parseFloat(q['03. high']),
            low:           parseFloat(q['04. low']),
            volume:        parseInt(q['06. volume']),
            currency:      'USD',
            source:        'alphavantage',
          };
        }
      }
    } catch { /* fall through */ }
  }

  // Yahoo Finance quote
  const crumb = await getYahooCrumb();
  const sym   = encodeURIComponent(symbol);
  const urls  = [
    ...(crumb ? [`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d&crumb=${encodeURIComponent(crumb.crumb)}`] : []),
    `https://query1.finance.yahoo.com/v7/finance/chart/${sym}?interval=1d&range=5d`,
    `https://query2.finance.yahoo.com/v7/finance/chart/${sym}?interval=1d&range=5d`,
  ];
  for (const url of urls) {
    try {
      const headers: Record<string, string> = { ...BASE_HEADERS };
      if (crumb?.cookie) headers['Cookie'] = crumb.cookie;
      const res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) continue;
      const json = await res.json();
      const r    = json?.chart?.result?.[0];
      if (!r) continue;
      const meta = r.meta ?? {};
      return {
        symbol,
        price:         meta.regularMarketPrice ?? 0,
        change:        meta.regularMarketPrice - meta.chartPreviousClose,
        changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
        open:          meta.regularMarketOpen   ?? 0,
        high:          meta.regularMarketDayHigh ?? 0,
        low:           meta.regularMarketDayLow  ?? 0,
        volume:        meta.regularMarketVolume  ?? 0,
        currency:      meta.currency ?? 'USD',
        source:        'yahoo',
      };
    } catch { continue; }
  }
  return null;
}

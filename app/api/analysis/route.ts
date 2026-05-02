import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  type OHLCV,
  computeIndicators,
  generateSignal,
  computeCombined,
  type FundamentalAnalysis,
  type FundamentalMetric,
} from '@/lib/technicalAnalysis';

// ─── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, { ts: number; data: unknown }>();
function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttl * 1000) return Promise.resolve(hit.data as T);
  return fn().then(data => { cache.set(key, { ts: Date.now(), data }); return data; });
}

const YAHOO_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const YAHOO_HEADERS = {
  'User-Agent': YAHOO_UA,
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
};

// Yahoo Finance cookie+crumb (needed to avoid 429)
let _yfCrumb: { crumb: string; cookie: string; expiry: number } | null = null;

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (_yfCrumb && Date.now() < _yfCrumb.expiry) return _yfCrumb;
  try {
    const r1 = await fetch('https://finance.yahoo.com/', {
      headers: {
        'User-Agent': YAHOO_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    // getSetCookie() returns array in Node 18+; fall back to comma-split
    const h = r1.headers as unknown as { getSetCookie?: () => string[] };
    const cookieArr: string[] =
      typeof h.getSetCookie === 'function'
        ? h.getSetCookie()
        : (r1.headers.get('set-cookie') ?? '').split(/,(?=\s*[A-Za-z_][^=]+=)/).filter(Boolean);
    const cookie = cookieArr.map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
    if (!cookie) return null;

    const r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...YAHOO_HEADERS, 'Cookie': cookie },
    });
    if (!r2.ok) return null;
    const crumb = (await r2.text()).trim();
    if (!crumb || crumb.startsWith('<') || crumb === 'Unauthorized') return null;
    _yfCrumb = { crumb, cookie, expiry: Date.now() + 50 * 60 * 1000 };
    return _yfCrumb;
  } catch { return null; }
}

async function yahooFetch(url: string): Promise<Response> {
  const auth = await getYahooCrumb();
  const sep = url.includes('?') ? '&' : '?';
  const base = auth ? `${url}${sep}crumb=${encodeURIComponent(auth.crumb)}` : url;
  const headers: Record<string, string> = { ...YAHOO_HEADERS };
  if (auth?.cookie) headers['Cookie'] = auth.cookie;

  const urls = [
    base,
    base.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com'),
  ];
  for (const u of urls) {
    const res = await fetch(u, { headers, cache: 'no-store' });
    if (res.ok) return res;
    if (res.status !== 429 && res.status !== 503) return res;
  }
  throw new Error('Yahoo unavailable');
}

// ─── Timeframe mappings ───────────────────────────────────────────────────────

const TF_YAHOO: Record<string, { interval: string; range: string }> = {
  '15m': { interval: '15m', range: '5d' },
  '1h':  { interval: '1h',  range: '30d' },
  '4h':  { interval: '1h',  range: '60d' }, // Yahoo has no 4h; downsample later
  '1d':  { interval: '1d',  range: '180d' },
};

const TF_BINANCE: Record<string, string> = {
  '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d',
};

// ─── Fetch OHLCV ─────────────────────────────────────────────────────────────

async function fetchStockOHLCV(symbol: string, timeframe: string): Promise<OHLCV[]> {
  const tf = TF_YAHOO[timeframe] ?? TF_YAHOO['1d'];
  const ttl = timeframe === '15m' ? 60 : timeframe === '1h' ? 300 : 3600;
  return cached(`stock-ohlcv:${symbol}:${timeframe}`, ttl, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${tf.interval}&range=${tf.range}`;
    const res = await yahooFetch(url);
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error('Yahoo: no data');
    const ts: number[]    = result.timestamp ?? [];
    const q                = result.indicators.quote[0];
    const opens: number[] = q.open ?? [];
    const highs: number[] = q.high ?? [];
    const lows: number[]  = q.low  ?? [];
    const closes: number[]= q.close ?? [];
    const vols: number[]  = q.volume ?? [];
    const candles: OHLCV[] = ts
      .map((t, i) => ({ time: t, open: opens[i], high: highs[i], low: lows[i], close: closes[i], volume: vols[i] ?? 0 }))
      .filter(c => c.open != null && c.close != null && c.close > 0);

    // Resample 1h → 4h if needed
    if (timeframe === '4h') return resample4h(candles);
    return candles;
  });
}

function resample4h(candles: OHLCV[]): OHLCV[] {
  const out: OHLCV[] = [];
  for (let i = 0; i < candles.length; i += 4) {
    const chunk = candles.slice(i, i + 4);
    if (chunk.length < 2) continue;
    out.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, c) => s + c.volume, 0),
    });
  }
  return out;
}

async function fetchCryptoOHLCV(symbol: string, timeframe: string): Promise<OHLCV[]> {
  const binSymbol = symbol.replace('/', '').toUpperCase();
  const interval = TF_BINANCE[timeframe] ?? '1d';
  const ttl = timeframe === '15m' ? 30 : timeframe === '1h' ? 120 : 600;
  return cached(`crypto-ohlcv:${binSymbol}:${timeframe}`, ttl, async () => {
    const limit = 200;
    const urls = [
      `https://api.binance.com/api/v3/klines?symbol=${binSymbol}&interval=${interval}&limit=${limit}`,
      `https://api.binance.us/api/v3/klines?symbol=${binSymbol}&interval=${interval}&limit=${limit}`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const data = await res.json();
        return (data as unknown[][]).map(k => ({
          time:   Math.floor(Number(k[0]) / 1000),
          open:   parseFloat(String(k[1])),
          high:   parseFloat(String(k[2])),
          low:    parseFloat(String(k[3])),
          close:  parseFloat(String(k[4])),
          volume: parseFloat(String(k[5])),
        }));
      } catch { continue; }
    }
    throw new Error('Binance unavailable');
  });
}

// ─── Fundamental analysis — stocks ───────────────────────────────────────────

const GROWTH_SECTORS = new Set(['Technology', 'Communication Services', 'Consumer Cyclical', 'Healthcare']);
const VALUE_SECTORS  = new Set(['Financials', 'Energy', 'Utilities', 'Materials', 'Industrials']);

function getPEThresholds(sector: string): { peBull: number; peBear: number; fwdBull: number; fwdBear: number } {
  if (GROWTH_SECTORS.has(sector)) return { peBull: 40, peBear: 65, fwdBull: 35, fwdBear: 55 };
  if (VALUE_SECTORS.has(sector))  return { peBull: 18, peBear: 30, fwdBull: 15, fwdBear: 25 };
  return { peBull: 25, peBear: 45, fwdBull: 22, fwdBear: 40 };
}

async function fetchStockFundamentals(symbol: string): Promise<FundamentalAnalysis> {
  return cached(`fund-stock:${symbol}`, 6 * 3600, async () => {
    const url = `https://query1.finance.yahoo.com/v11/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryDetail,financialData,defaultKeyStatistics,price,assetProfile`;
    const res = await yahooFetch(url);
    if (!res.ok) return insufficientData();
    const json = await res.json();
    const r = json?.quoteSummary?.result?.[0];
    if (!r) return insufficientData();

    const sd  = r.summaryDetail ?? {};
    const fd  = r.financialData ?? {};
    const ks  = r.defaultKeyStatistics ?? {};
    const ap  = r.assetProfile ?? {};
    const sector: string = ap.sector ?? '';

    const pe    = sd.trailingPE?.raw ?? null;
    const fwdPE = sd.forwardPE?.raw ?? null;
    const roe   = fd.returnOnEquity?.raw ?? null;
    const margin= fd.profitMargins?.raw ?? null;
    const de    = fd.debtToEquity?.raw ?? null;
    const rev   = fd.revenueGrowth?.raw ?? null;

    const useful = [pe, fwdPE, roe, margin].filter(v => v !== null);
    if (useful.length < 2) return insufficientData();

    const thresholds = getPEThresholds(sector);
    const highlights: string[] = [], risks: string[] = [];
    const metrics: FundamentalMetric[] = [];
    let score = 50;

    if (pe !== null) {
      const sig: FundamentalMetric['signal'] = pe < thresholds.peBull ? 'positive' : pe > thresholds.peBear ? 'negative' : 'neutral';
      metrics.push({ label: 'P/E trailing', value: pe.toFixed(1), signal: sig });
      if (sig === 'positive') { score += 12; highlights.push(`P/E ${pe.toFixed(1)} atractiu pel sector.`); }
      else if (sig === 'negative') { score -= 12; risks.push(`P/E ${pe.toFixed(1)} elevat pel sector.`); }
    }
    if (fwdPE !== null) {
      const sig: FundamentalMetric['signal'] = fwdPE < thresholds.fwdBull ? 'positive' : fwdPE > thresholds.fwdBear ? 'negative' : 'neutral';
      metrics.push({ label: 'P/E forward', value: fwdPE.toFixed(1), signal: sig });
      if (sig === 'positive') { score += 10; highlights.push(`P/E forward ${fwdPE.toFixed(1)} suggereix creixement sostenible.`); }
      else if (sig === 'negative') { score -= 10; risks.push(`P/E forward ${fwdPE.toFixed(1)} desconta creixement molt optimista.`); }
    }
    if (roe !== null) {
      const pct = roe * 100;
      const sig: FundamentalMetric['signal'] = pct >= 15 ? 'positive' : pct < 8 ? 'negative' : 'neutral';
      metrics.push({ label: 'ROE', value: `${pct.toFixed(1)}%`, signal: sig });
      if (sig === 'positive') { score += 10; highlights.push(`ROE ${pct.toFixed(1)}% — alta rendibilitat del capital.`); }
      else if (sig === 'negative') { score -= 10; risks.push(`ROE ${pct.toFixed(1)}% baix.`); }
    }
    if (margin !== null) {
      const pct = margin * 100;
      const sig: FundamentalMetric['signal'] = pct >= 15 ? 'positive' : pct < 5 ? 'negative' : 'neutral';
      metrics.push({ label: 'Marge net', value: `${pct.toFixed(1)}%`, signal: sig });
      if (sig === 'positive') highlights.push(`Marges nets saludables (${pct.toFixed(1)}%).`);
      else if (sig === 'negative') risks.push(`Marges nets comprimits (${pct.toFixed(1)}%).`);
    }
    if (de !== null) {
      const sig: FundamentalMetric['signal'] = de < 50 ? 'positive' : de > 150 ? 'negative' : 'neutral';
      metrics.push({ label: 'Deute/Equity', value: `${de.toFixed(0)}%`, signal: sig });
      if (sig === 'negative') risks.push(`Apalancament elevat (D/E ${de.toFixed(0)}%).`);
    }
    if (rev !== null) {
      const pct = rev * 100;
      const sig: FundamentalMetric['signal'] = pct >= 10 ? 'positive' : pct < 0 ? 'negative' : 'neutral';
      metrics.push({ label: 'Creixement ingressos', value: `${pct.toFixed(1)}%`, signal: sig });
      if (sig === 'positive') highlights.push(`Creixement d'ingressos del ${pct.toFixed(1)}%.`);
      else if (sig === 'negative') risks.push(`Ingressos en contracció (${pct.toFixed(1)}%).`);
    }

    score = Math.min(100, Math.max(0, score));
    const verdict: FundamentalAnalysis['verdict'] =
      score >= 65 ? 'Favorable' : score <= 40 ? 'Débil' : 'Neutral';

    return {
      verdict, score,
      summary: `Anàlisi fonamental basada en ${metrics.length} mètrics de Yahoo Finance${sector ? ` (sector: ${sector})` : ''}.`,
      metrics, highlights, risks,
    };
  });
}

// ─── Fundamental analysis — crypto ───────────────────────────────────────────

async function fetchCryptoFundamentals(symbol: string): Promise<FundamentalAnalysis> {
  const binSymbol = symbol.replace('/', '').toUpperCase();
  return cached(`fund-crypto:${binSymbol}`, 300, async () => {
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binSymbol}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return insufficientData();
    const d = await res.json() as Record<string, string>;

    const priceChange = parseFloat(d.priceChangePercent ?? '0');
    const volume      = parseFloat(d.volume ?? '0');
    const quoteVol    = parseFloat(d.quoteVolume ?? '0');
    const high        = parseFloat(d.highPrice ?? '0');
    const low         = parseFloat(d.lowPrice ?? '0');
    const close       = parseFloat(d.lastPrice ?? '0');

    if (!close || !volume) return insufficientData();

    const metrics: FundamentalMetric[] = [];
    const highlights: string[] = [], risks: string[] = [];
    let score = 50;

    // 24h change
    const changeSig: FundamentalMetric['signal'] = priceChange > 2 ? 'positive' : priceChange < -2 ? 'negative' : 'neutral';
    metrics.push({ label: 'Canvi 24h', value: `${priceChange.toFixed(2)}%`, signal: changeSig });
    if (changeSig === 'positive') { score += 10; highlights.push(`Momentum positiu +${priceChange.toFixed(2)}% en 24h.`); }
    else if (changeSig === 'negative') { score -= 10; risks.push(`Caiguda del ${priceChange.toFixed(2)}% en 24h.`); }

    // Position in day range
    const range = high - low;
    if (range > 0) {
      const pos = (close - low) / range;
      const posSig: FundamentalMetric['signal'] = pos > 0.6 ? 'positive' : pos < 0.4 ? 'negative' : 'neutral';
      metrics.push({ label: 'Posició rang 24h', value: `${(pos * 100).toFixed(0)}%`, signal: posSig });
      if (posSig === 'positive') highlights.push('Preu al terç superior del rang diari.');
      else if (posSig === 'negative') risks.push('Preu al terç inferior del rang diari.');
    }

    // Volume in quote currency (USD-equiv)
    const volSig: FundamentalMetric['signal'] = quoteVol > 50_000_000 ? 'positive' : quoteVol < 1_000_000 ? 'negative' : 'neutral';
    metrics.push({ label: 'Volum 24h (USD)', value: formatLargeNum(quoteVol), signal: volSig });
    if (volSig === 'positive') highlights.push('Liquiditat elevada.');
    else if (volSig === 'negative') risks.push('Liquiditat baixa: spread potencialment ample.');

    score = Math.min(100, Math.max(0, score));
    const verdict: FundamentalAnalysis['verdict'] =
      score >= 65 ? 'Favorable' : score <= 40 ? 'Débil' : 'Neutral';

    return { verdict, score, summary: 'Anàlisi de mercat de 24h via Binance.', metrics, highlights, risks };
  });
}

function formatLargeNum(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function insufficientData(): FundamentalAnalysis {
  return { verdict: 'Datos insuficientes', score: null, summary: 'No s\'han pogut obtenir dades fonamentals suficients.', metrics: [], highlights: [], risks: [] };
}

// ─── Validation ───────────────────────────────────────────────────────────────

const STOCK_RE  = /^[A-Z0-9.\-^=]{1,20}$/i;
const CRYPTO_RE = /^[A-Z0-9]{2,20}(\/[A-Z]{2,10})?$/i;

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'authorized' && role !== 'admin') {
    return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const symbol     = (searchParams.get('symbol') ?? '').trim().toUpperCase();
  const asset_type = (searchParams.get('asset_type') ?? 'stock') as 'stock' | 'crypto';
  const timeframe  = searchParams.get('timeframe') ?? '1d';

  if (!symbol) return NextResponse.json({ error: 'symbol requerit' }, { status: 400 });
  const re = asset_type === 'crypto' ? CRYPTO_RE : STOCK_RE;
  if (!re.test(symbol)) return NextResponse.json({ error: 'symbol no vàlid' }, { status: 400 });
  if (!['15m', '1h', '4h', '1d'].includes(timeframe))
    return NextResponse.json({ error: 'timeframe no vàlid' }, { status: 400 });

  try {
    const [candles, fundamental] = await Promise.all([
      asset_type === 'crypto' ? fetchCryptoOHLCV(symbol, timeframe) : fetchStockOHLCV(symbol, timeframe),
      asset_type === 'crypto' ? fetchCryptoFundamentals(symbol) : fetchStockFundamentals(symbol),
    ]);

    if (candles.length < 10) {
      return NextResponse.json({ error: 'Dades insuficients per a anàlisi.' }, { status: 422 });
    }

    const indicators = computeIndicators(candles);
    const signal     = generateSignal(candles, indicators, timeframe);
    const combined   = computeCombined(signal, fundamental, timeframe);

    return NextResponse.json({
      symbol, asset_type, timeframe,
      candles: candles.slice(-200),
      indicators: {
        ...indicators,
        ema20:  indicators.ema20.slice(-200),
        ema50:  indicators.ema50.slice(-200),
        ema200: indicators.ema200.slice(-200),
      },
      signal, fundamental, combined,
    });
  } catch (err) {
    console.error('[analysis]', err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

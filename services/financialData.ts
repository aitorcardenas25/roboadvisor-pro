// services/financialData.ts
// Servei principal d'obtenció de dades financeres (server-side only).
// Gestiona la cadena FMP → Alpha Vantage → Yahoo → Simulat.
// Cap clau API s'exposa al client.

import type { MarketDataPoint, FundDataResult, DataSource } from '@/lib/marketData';
import { PRODUCT_TICKERS, calculateMonthlyReturns } from '@/lib/marketData';

// ── Cache en memòria (revalidació automàtica per segment) ─────────────────────
const cache = new Map<string, { data: FundDataResult; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

function getCached(key: string): FundDataResult | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.data;
}

function setCache(key: string, data: FundDataResult) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── FMP ───────────────────────────────────────────────────────────────────────

async function fromFMP(ticker: string, fromDate: string, toDate: string): Promise<MarketDataPoint[]> {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error('no_key');

  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${ticker}?from=${fromDate}&to=${toDate}&apikey=${key}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`fmp_${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json.historical)) throw new Error('fmp_no_data');

  return (json.historical as Record<string, number | string>[])
    .map(d => ({
      date:          String(d.date),
      open:          Number(d.open),
      high:          Number(d.high),
      low:           Number(d.low),
      close:         Number(d.close),
      volume:        Number(d.volume),
      adjustedClose: Number(d.adjClose ?? d.close),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Alpha Vantage ─────────────────────────────────────────────────────────────

async function fromAlphaVantage(symbol: string): Promise<MarketDataPoint[]> {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error('no_key');

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${key}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`av_${res.status}`);

  const json = await res.json();
  const series = json['Monthly Adjusted Time Series'];
  if (!series) throw new Error('av_no_data');

  return Object.entries(series)
    .map(([date, v]) => {
      const vals = v as Record<string, string>;
      return {
        date,
        open:          parseFloat(vals['1. open']),
        high:          parseFloat(vals['2. high']),
        low:           parseFloat(vals['3. low']),
        close:         parseFloat(vals['4. close']),
        volume:        parseFloat(vals['6. volume']),
        adjustedClose: parseFloat(vals['5. adjusted close']),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Yahoo Finance (server-side, sense API key) ────────────────────────────────

async function fromYahoo(ticker: string, period: string): Promise<MarketDataPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=${period}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; factorOTC/1.0)' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`yahoo_${res.status}`);

  const json  = await res.json();
  const chart = json?.chart?.result?.[0];
  if (!chart) throw new Error('yahoo_no_data');

  const timestamps: number[] = chart.timestamp ?? [];
  const closes: number[]     = chart.indicators?.adjclose?.[0]?.adjclose
                             ?? chart.indicators?.quote?.[0]?.close ?? [];
  const opens: number[]      = chart.indicators?.quote?.[0]?.open  ?? [];
  const highs: number[]      = chart.indicators?.quote?.[0]?.high  ?? [];
  const lows: number[]       = chart.indicators?.quote?.[0]?.low   ?? [];

  return timestamps
    .map((ts, i) => ({
      date:          new Date(ts * 1000).toISOString().split('T')[0],
      open:          opens[i]  ?? closes[i] ?? 0,
      high:          highs[i]  ?? closes[i] ?? 0,
      low:           lows[i]   ?? closes[i] ?? 0,
      close:         closes[i] ?? 0,
      adjustedClose: closes[i] ?? 0,
    }))
    .filter(p => p.close > 0);
}

// ── Dades simulades ───────────────────────────────────────────────────────────

function buildSimulated(productId: string, isin: string, months: number): FundDataResult {
  let annualReturn = 8.0;
  let annualVol    = 15.0;
  try {
    const { FINANCIAL_PRODUCTS } = require('@/lib/products');
    const p = FINANCIAL_PRODUCTS.find((x: { id: string }) => x.id === productId);
    if (p?.historicalReturn5Y)   annualReturn = p.historicalReturn5Y;
    if (p?.historicalVolatility) annualVol    = p.historicalVolatility;
  } catch { /* ok */ }

  const mr = annualReturn / 12 / 100;
  const mv = annualVol / Math.sqrt(12) / 100;
  const prices: MarketDataPoint[] = [];
  const returns: number[] = [];
  let price = 100;
  const start = new Date();
  start.setMonth(start.getMonth() - months);

  for (let i = 0; i <= months; i++) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    if (i > 0) {
      let u = 0, v = 0;
      while (!u) u = Math.random();
      while (!v) v = Math.random();
      const r = mr + mv * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      price = Math.max(1, price * (1 + r));
      returns.push(Math.round(r * 10000) / 100);
    }
    prices.push({ date: d.toISOString().split('T')[0], open: price, high: price * 1.005, low: price * 0.995, close: price, adjustedClose: price });
  }

  return {
    productId, isin, name: productId, currency: 'EUR', prices, returns,
    latestPrice: price, latestDate: prices.at(-1)?.date,
    source: 'simulated', status: 'simulated',
    errorMessage: 'Dades simulades. Configura FMP_API_KEY o ALPHA_VANTAGE_API_KEY per a dades reals.',
  };
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function getProductData(
  productId: string,
  isin: string,
  period: '1y' | '2y' | '5y' = '5y',
): Promise<FundDataResult> {
  const cacheKey = `${productId}:${period}`;
  const cached   = getCached(cacheKey);
  if (cached) return cached;

  const tickers = PRODUCT_TICKERS[productId];
  const months  = period === '1y' ? 12 : period === '2y' ? 24 : 60;

  const toDate   = new Date().toISOString().split('T')[0];
  const fromDate = new Date(Date.now() - months * 30.5 * 86400000).toISOString().split('T')[0];

  const buildResult = (prices: MarketDataPoint[], source: DataSource): FundDataResult => ({
    productId, isin, ticker: tickers?.[source as keyof typeof tickers] as string | undefined,
    name: productId, currency: 'EUR', prices,
    returns: calculateMonthlyReturns(prices),
    latestPrice: prices.at(-1)?.close,
    latestDate:  prices.at(-1)?.date,
    source, status: source === 'yahoo' ? 'partial' : 'success',
  });

  // 1. FMP
  if (tickers?.fmp) {
    try {
      const prices = await fromFMP(tickers.fmp, fromDate, toDate);
      if (prices.length > 0) { const r = buildResult(prices, 'fmp'); setCache(cacheKey, r); return r; }
    } catch { /* continua */ }
  }

  // 2. Alpha Vantage
  if (tickers?.alphaVantage) {
    try {
      const prices = await fromAlphaVantage(tickers.alphaVantage);
      if (prices.length > 0) { const r = buildResult(prices, 'alphavantage'); setCache(cacheKey, r); return r; }
    } catch { /* continua */ }
  }

  // 3. Yahoo Finance
  if (tickers?.yahoo) {
    try {
      const prices = await fromYahoo(tickers.yahoo, period);
      if (prices.length > 0) { const r = buildResult(prices, 'yahoo'); setCache(cacheKey, r); return r; }
    } catch { /* continua */ }
  }

  // 4. Simulat
  const r = buildSimulated(productId, isin, months);
  setCache(cacheKey, r);
  return r;
}

export async function getBatchData(
  products: { productId: string; isin: string }[],
  period: '1y' | '2y' | '5y' = '5y',
): Promise<FundDataResult[]> {
  return Promise.all(products.map(p => getProductData(p.productId, p.isin, period)));
}

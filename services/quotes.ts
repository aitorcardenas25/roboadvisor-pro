// services/quotes.ts
// Quotes en temps real per accions, ETFs i índexs (server-side only).

export interface Quote {
  symbol:        string;
  name:          string;
  price:         number;
  change:        number;
  changePercent: number;
  open:          number;
  high:          number;
  low:           number;
  volume:        number;
  marketCap?:    number;
  pe?:           number;
  eps?:          number;
  week52High?:   number;
  week52Low?:    number;
  currency:      string;
  exchange:      string;
  source:        'fmp' | 'yahoo' | 'simulated';
  timestamp:     string;
}

// ── Cache curta (5 min per a quotes) ─────────────────────────────────────────
const quoteCache = new Map<string, { data: Quote; expiresAt: number }>();
const QUOTE_TTL  = 5 * 60 * 1000;

function getCachedQuote(symbol: string): Quote | null {
  const e = quoteCache.get(symbol.toUpperCase());
  return e && Date.now() < e.expiresAt ? e.data : null;
}

function setCachedQuote(symbol: string, data: Quote) {
  quoteCache.set(symbol.toUpperCase(), { data, expiresAt: Date.now() + QUOTE_TTL });
}

// ── FMP quote ─────────────────────────────────────────────────────────────────

async function quoteFromFMP(symbol: string): Promise<Quote> {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error('no_fmp_key');

  const [quoteRes, profileRes] = await Promise.allSettled([
    fetch(`https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${key}`, { next: { revalidate: 300 } }),
    fetch(`https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${key}`, { next: { revalidate: 3600 } }),
  ]);

  if (quoteRes.status !== 'fulfilled' || !quoteRes.value.ok) throw new Error('fmp_quote_fail');
  const quoteData = await quoteRes.value.json();
  const q = quoteData[0];
  if (!q) throw new Error('fmp_no_data');

  let name = q.name ?? symbol;
  if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
    const profileData = await profileRes.value.json();
    name = profileData[0]?.companyName ?? name;
  }

  return {
    symbol:        q.symbol,
    name,
    price:         q.price         ?? 0,
    change:        q.change        ?? 0,
    changePercent: q.changesPercentage ?? 0,
    open:          q.open          ?? q.price ?? 0,
    high:          q.dayHigh       ?? q.price ?? 0,
    low:           q.dayLow        ?? q.price ?? 0,
    volume:        q.volume        ?? 0,
    marketCap:     q.marketCap,
    pe:            q.pe,
    eps:           q.eps,
    week52High:    q['52WeekHigh'],
    week52Low:     q['52WeekLow'],
    currency:      q.currency ?? 'USD',
    exchange:      q.exchange ?? '',
    source:        'fmp',
    timestamp:     new Date().toISOString(),
  };
}

// ── Yahoo Finance quote (sense clau) ─────────────────────────────────────────

async function quoteFromYahoo(symbol: string): Promise<Quote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; factorOTC/1.0)' },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`yahoo_${res.status}`);

  const json  = await res.json();
  const chart = json?.chart?.result?.[0];
  if (!chart) throw new Error('yahoo_no_data');

  const meta   = chart.meta ?? {};
  const price  = meta.regularMarketPrice ?? 0;
  const prev   = meta.previousClose      ?? price;
  const change = price - prev;

  return {
    symbol:        symbol.toUpperCase(),
    name:          meta.longName ?? meta.shortName ?? symbol,
    price,
    change,
    changePercent: prev ? (change / prev) * 100 : 0,
    open:          meta.regularMarketOpen  ?? price,
    high:          meta.regularMarketDayHigh ?? price,
    low:           meta.regularMarketDayLow  ?? price,
    volume:        meta.regularMarketVolume  ?? 0,
    week52High:    meta['52WeekHigh'],
    week52Low:     meta['52WeekLow'],
    currency:      meta.currency  ?? 'USD',
    exchange:      meta.exchangeName ?? '',
    source:        'yahoo',
    timestamp:     new Date().toISOString(),
  };
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function getQuote(symbol: string): Promise<Quote> {
  const sym    = symbol.toUpperCase();
  const cached = getCachedQuote(sym);
  if (cached) return cached;

  // 1. FMP
  if (process.env.FMP_API_KEY) {
    try {
      const q = await quoteFromFMP(sym);
      setCachedQuote(sym, q);
      return q;
    } catch { /* continua */ }
  }

  // 2. Yahoo Finance
  try {
    const q = await quoteFromYahoo(sym);
    setCachedQuote(sym, q);
    return q;
  } catch { /* continua */ }

  // 3. Simulated
  const simulated: Quote = {
    symbol: sym, name: sym, price: 100, change: 0, changePercent: 0,
    open: 100, high: 101, low: 99, volume: 0,
    currency: 'EUR', exchange: '—', source: 'simulated',
    timestamp: new Date().toISOString(),
  };
  return simulated;
}

export async function getBatchQuotes(symbols: string[]): Promise<Quote[]> {
  // FMP suporta batch de quotes en una crida
  if (process.env.FMP_API_KEY && symbols.length > 1) {
    try {
      const key = process.env.FMP_API_KEY;
      const sym = symbols.join(',');
      const res = await fetch(`https://financialmodelingprep.com/api/v3/quote/${sym}?apikey=${key}`, { next: { revalidate: 300 } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const quotes: Quote[] = data.map((q: Record<string, number | string>) => ({
            symbol:        String(q.symbol),
            name:          String(q.name ?? q.symbol),
            price:         Number(q.price)             ?? 0,
            change:        Number(q.change)            ?? 0,
            changePercent: Number(q.changesPercentage) ?? 0,
            open:          Number(q.open)              ?? 0,
            high:          Number(q.dayHigh)           ?? 0,
            low:           Number(q.dayLow)            ?? 0,
            volume:        Number(q.volume)            ?? 0,
            marketCap:     q.marketCap ? Number(q.marketCap) : undefined,
            pe:            q.pe ? Number(q.pe) : undefined,
            currency:      String(q.currency ?? 'USD'),
            exchange:      String(q.exchange ?? ''),
            source:        'fmp' as const,
            timestamp:     new Date().toISOString(),
          }));
          quotes.forEach(q => setCachedQuote(q.symbol, q));
          return quotes;
        }
      }
    } catch { /* fallback individual */ }
  }

  return Promise.all(symbols.map(s => getQuote(s)));
}

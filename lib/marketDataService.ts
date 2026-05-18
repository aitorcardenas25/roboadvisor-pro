const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

export interface PriceResult {
  symbol:    string;
  price:     number;
  source:    'fmp' | 'manual';
  updatedAt: string;
}

export async function fetchPrice(symbol: string): Promise<PriceResult | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;
  try {
    const res  = await fetch(`${FMP_BASE}/quote-short/${encodeURIComponent(symbol)}?apikey=${apiKey}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ symbol: string; price: number }>;
    if (!data[0]?.price) return null;
    return { symbol, price: data[0].price, source: 'fmp', updatedAt: new Date().toISOString().split('T')[0] };
  } catch {
    return null;
  }
}

export async function fetchPriceBatch(symbols: string[]): Promise<Record<string, PriceResult>> {
  const results: Record<string, PriceResult> = {};
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey || symbols.length === 0) return results;
  try {
    const joined = symbols.map(s => encodeURIComponent(s)).join(',');
    const res    = await fetch(`${FMP_BASE}/quote-short/${joined}?apikey=${apiKey}`, { next: { revalidate: 3600 } });
    if (!res.ok) return results;
    const data  = await res.json() as Array<{ symbol: string; price: number }>;
    const today = new Date().toISOString().split('T')[0];
    for (const item of data) {
      if (item.price) results[item.symbol] = { symbol: item.symbol, price: item.price, source: 'fmp', updatedAt: today };
    }
  } catch { /* silent — fallback to manual prices */ }
  return results;
}

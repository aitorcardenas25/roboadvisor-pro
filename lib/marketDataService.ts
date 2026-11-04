import { getAllClientPortfolios, getPortfolioById, updateHoldingPrice } from './clientPortfolios';
import type { ClientHolding } from './clientPortfolios';

const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceResult {
  symbol:    string;
  price:     number;
  source:    'fmp' | 'manual';
  updatedAt: string;
}

export interface HoldingUpdateResult {
  holdingId:   string;
  assetName:   string;
  symbol:      string;
  priceSource: 'fmp' | 'manual' | 'pending';
  price:       number | null;
  updated:     boolean;
  error?:      string;
}

export interface PortfolioRefreshResult {
  portfolioId: string;
  clientName:  string;
  total:       number;
  updated:     number;
  failed:      number;
  pending:     number;
  results:     HoldingUpdateResult[];
}

export interface BatchRefreshResult {
  portfolios:   PortfolioRefreshResult[];
  totalUpdated: number;
  totalFailed:  number;
  totalPending: number;
  durationMs:   number;
}

// ─── Single price (FMP quote-short) ──────────────────────────────────────────

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

// ─── Batch price (FMP quote-short with multiple symbols) ─────────────────────

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

// ─── Resolve symbol for a holding ─────────────────────────────────────────────
// Priority: assetSymbol → assetIsin. Returns null if no symbol available.

function resolveSymbol(holding: ClientHolding): string | null {
  if (holding.assetSymbol?.trim()) return holding.assetSymbol.trim();
  if (holding.assetIsin?.trim())   return holding.assetIsin.trim();
  return null;
}

// ─── Refresh all holdings in a portfolio ─────────────────────────────────────

export async function refreshPortfolioHoldingsPrices(
  portfolioId: string,
): Promise<PortfolioRefreshResult> {
  const portfolio = await getPortfolioById(portfolioId);
  if (!portfolio) {
    return { portfolioId, clientName: '?', total: 0, updated: 0, failed: 0, pending: 0, results: [] };
  }

  const holdings = portfolio.holdings;
  const apiKey   = process.env.FMP_API_KEY;

  // Collect all symbols and fetch in batch (one API call)
  const symbolMap = new Map<string, ClientHolding[]>();
  const noSymbol: ClientHolding[] = [];

  for (const h of holdings) {
    const sym = resolveSymbol(h);
    if (!sym) { noSymbol.push(h); continue; }
    const bucket = symbolMap.get(sym) ?? [];
    bucket.push(h);
    symbolMap.set(sym, bucket);
  }

  let prices: Record<string, PriceResult> = {};
  if (apiKey && symbolMap.size > 0) {
    prices = await fetchPriceBatch(Array.from(symbolMap.keys()));
  }

  const results: HoldingUpdateResult[] = [];

  // Update holdings that have a symbol
  for (const [sym, holdingList] of symbolMap.entries()) {
    const priceResult = prices[sym];
    for (const h of holdingList) {
      if (priceResult) {
        await updateHoldingPrice(h.id, portfolioId, priceResult.price, 'fmp');
        results.push({
          holdingId:   h.id,
          assetName:   h.assetName,
          symbol:      sym,
          priceSource: 'fmp',
          price:       priceResult.price,
          updated:     true,
        });
      } else if (!apiKey) {
        // No FMP key — mark as pending
        results.push({
          holdingId:   h.id,
          assetName:   h.assetName,
          symbol:      sym,
          priceSource: 'pending',
          price:       null,
          updated:     false,
          error:       'FMP_API_KEY no configurada. Configura-la per actualitzar preus automàticament.',
        });
      } else {
        // FMP didn't return price for this symbol
        results.push({
          holdingId:   h.id,
          assetName:   h.assetName,
          symbol:      sym,
          priceSource: 'pending',
          price:       null,
          updated:     false,
          error:       `Preu no disponible a FMP per al símbol "${sym}". Actualitza manualment.`,
        });
      }
    }
  }

  // Holdings without symbol → always pending
  for (const h of noSymbol) {
    results.push({
      holdingId:   h.id,
      assetName:   h.assetName,
      symbol:      '—',
      priceSource: 'pending',
      price:       null,
      updated:     false,
      error:       'Sense símbol/ISIN. Afegeix el ticker o ISIN a la posició per actualitzar automàticament.',
    });
  }

  return {
    portfolioId,
    clientName: portfolio.clientName,
    total:   results.length,
    updated: results.filter(r => r.updated).length,
    failed:  results.filter(r => !r.updated && r.priceSource !== 'pending').length,
    pending: results.filter(r => r.priceSource === 'pending').length,
    results,
  };
}

// ─── Refresh all portfolios (admin batch operation) ───────────────────────────

export async function refreshAllPortfoliosPrices(): Promise<BatchRefreshResult> {
  const start      = Date.now();
  const portfolios = await getAllClientPortfolios();

  const portfolioResults = await Promise.all(
    portfolios.map(p => refreshPortfolioHoldingsPrices(p.id)),
  );

  return {
    portfolios:   portfolioResults,
    totalUpdated: portfolioResults.reduce((s, p) => s + p.updated, 0),
    totalFailed:  portfolioResults.reduce((s, p) => s + p.failed, 0),
    totalPending: portfolioResults.reduce((s, p) => s + p.pending, 0),
    durationMs:   Date.now() - start,
  };
}

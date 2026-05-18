import { getDb } from './supabase';

export type StockRating = 'buy' | 'hold' | 'avoid' | 'watch';

export interface StockReport {
  id:            string;
  ticker:        string;
  company:       string;
  sector:        string;
  rating:        StockRating;
  summary:       string;
  fundamentals:  string;
  technicals:    string;
  risks:         string;
  conclusion:    string;
  targetPrice?:  number;
  currentPrice?: number;
  currency:      string;
  status:        'draft' | 'published';
  visibleTo:     'all' | 'clients';
  publishedAt?:  string;
  updatedAt:     string;
  createdAt:     string;
}

let _db: StockReport[] = [];

function rowToReport(r: Record<string, unknown>): StockReport {
  return {
    id:           r.id as string,
    ticker:       r.ticker as string,
    company:      r.company as string,
    sector:       (r.sector as string) ?? '',
    rating:       r.rating as StockRating,
    summary:      (r.summary as string) ?? '',
    fundamentals: (r.fundamentals as string) ?? '',
    technicals:   (r.technicals as string) ?? '',
    risks:        (r.risks as string) ?? '',
    conclusion:   (r.conclusion as string) ?? '',
    targetPrice:  r.target_price != null ? Number(r.target_price) : undefined,
    currentPrice: r.current_price != null ? Number(r.current_price) : undefined,
    currency:     (r.currency as string) ?? 'EUR',
    status:       r.status as 'draft' | 'published',
    visibleTo:    (r.visible_to as StockReport['visibleTo']) ?? 'clients',
    publishedAt:  r.published_at as string | undefined,
    updatedAt:    r.updated_at as string,
    createdAt:    r.created_at as string,
  };
}

export async function getAllStockReports(): Promise<StockReport[]> {
  const db = getDb();
  if (!db) return [..._db].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const { data, error } = await db.from('stock_reports').select('*').order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => rowToReport(r as Record<string, unknown>));
}

export async function getPublishedStockReports(role: string): Promise<StockReport[]> {
  const isAuthenticated = role === 'client' || role === 'admin';

  const db = getDb();
  if (!db) {
    return _db.filter(r => {
      if (r.status !== 'published') return false;
      if (r.visibleTo === 'all') return true;
      if (r.visibleTo === 'clients') return isAuthenticated;
      return false;
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const { data, error } = await db.from('stock_reports')
    .select('*')
    .eq('status', 'published')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map(r => rowToReport(r as Record<string, unknown>))
    .filter(r => {
      if (r.visibleTo === 'all') return true;
      if (r.visibleTo === 'clients') return isAuthenticated;
      return false;
    });
}

export async function getStockReportById(id: string): Promise<StockReport | null> {
  const db = getDb();
  if (!db) return _db.find(r => r.id === id) ?? null;
  const { data, error } = await db.from('stock_reports').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToReport(data as Record<string, unknown>) : null;
}

export async function createStockReport(
  input: Pick<StockReport, 'ticker' | 'company' | 'sector' | 'rating' | 'summary' | 'fundamentals' | 'technicals' | 'risks' | 'conclusion' | 'visibleTo' | 'status'> &
         Partial<Pick<StockReport, 'targetPrice' | 'currentPrice' | 'currency'>>
): Promise<StockReport> {
  const now    = new Date().toISOString();
  const report: StockReport = {
    id:           `sr-${Date.now()}`,
    currency:     'EUR',
    ...input,
    updatedAt:    now,
    createdAt:    now,
  };
  const db = getDb();
  if (!db) { _db.push(report); return report; }
  const { error } = await db.from('stock_reports').insert({
    id: report.id, ticker: report.ticker, company: report.company, sector: report.sector,
    rating: report.rating, summary: report.summary, fundamentals: report.fundamentals,
    technicals: report.technicals, risks: report.risks, conclusion: report.conclusion,
    target_price: report.targetPrice ?? null, current_price: report.currentPrice ?? null,
    currency: report.currency, status: report.status, visible_to: report.visibleTo,
    published_at: report.status === 'published' ? now : null,
    updated_at: now, created_at: now,
  });
  if (error) throw new Error(error.message);
  return report;
}

export async function updateStockReport(
  id: string,
  updates: Partial<Omit<StockReport, 'id' | 'createdAt'>>
): Promise<StockReport | null> {
  const now = new Date().toISOString();
  const db  = getDb();
  if (!db) {
    const idx = _db.findIndex(r => r.id === id);
    if (idx === -1) return null;
    _db[idx] = { ..._db[idx], ...updates, updatedAt: now };
    return _db[idx];
  }
  const patch: Record<string, unknown> = { updated_at: now };
  const map: Record<string, string> = {
    ticker: 'ticker', company: 'company', sector: 'sector', rating: 'rating',
    summary: 'summary', fundamentals: 'fundamentals', technicals: 'technicals',
    risks: 'risks', conclusion: 'conclusion', targetPrice: 'target_price',
    currentPrice: 'current_price', currency: 'currency', status: 'status',
    visibleTo: 'visible_to', publishedAt: 'published_at',
  };
  for (const [k, col] of Object.entries(map)) {
    if (k in updates) patch[col] = updates[k as keyof typeof updates] ?? null;
  }
  if ('status' in updates && updates.status === 'published' && !('publishedAt' in updates)) {
    patch.published_at = now;
  }
  const { data, error } = await db.from('stock_reports').update(patch).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToReport(data as Record<string, unknown>) : null;
}

export async function deleteStockReport(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const idx = _db.findIndex(r => r.id === id);
    if (idx === -1) return false;
    _db.splice(idx, 1);
    return true;
  }
  const { error } = await db.from('stock_reports').delete().eq('id', id);
  return !error;
}

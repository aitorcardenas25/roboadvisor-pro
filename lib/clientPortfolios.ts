import { getDb } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientHolding {
  id:               string;
  assetIsin:        string;
  assetName:        string;
  assetSymbol?:     string;
  assetCategory:    string;
  broker:           string;
  quantity:         number;
  avgEntryPrice:    number;   // EUR, weighted average
  currentPrice:     number;   // EUR, manually updated by admin
  priceLastUpdated: string;
  currency:         string;
  notes?:           string;
}

export interface ClientTransaction {
  id:        string;
  holdingId: string;
  type:      'buy' | 'sell';
  date:      string;
  quantity:  number;
  priceEur:  number;
  totalEur:  number;
  broker:    string;
  notes?:    string;
}

export interface AdvisorNote {
  id:     string;
  date:   string;
  author: string;
  text:   string;
}

export interface ClientPortfolio {
  id:              string;
  clientId:        string;
  clientName:      string;
  name:            string;
  description:     string;
  holdings:        ClientHolding[];
  transactions:    ClientTransaction[];
  advisorNotes:    AdvisorNote[];
  recommendations: string;
  createdAt:       string;
  updatedAt:       string;
}

export interface PortfolioMetrics {
  totalInvested: number;
  currentValue:  number;
  pnlEur:        number;
  pnlPct:        number;
  holdingCount:  number;
}

// ─── Computed metrics ─────────────────────────────────────────────────────────

export function computeMetrics(p: ClientPortfolio): PortfolioMetrics {
  const totalInvested = p.holdings.reduce((s, h) => s + h.avgEntryPrice * h.quantity, 0);
  const currentValue  = p.holdings.reduce((s, h) => s + h.currentPrice  * h.quantity, 0);
  const pnlEur = currentValue - totalInvested;
  return {
    totalInvested: Math.round(totalInvested * 100) / 100,
    currentValue:  Math.round(currentValue  * 100) / 100,
    pnlEur:        Math.round(pnlEur        * 100) / 100,
    pnlPct:        totalInvested > 0 ? Math.round((pnlEur / totalInvested) * 10000) / 100 : 0,
    holdingCount:  p.holdings.length,
  };
}

// ─── In-memory store (fallback when Supabase not configured) ─────────────────

let _db: ClientPortfolio[] = [];

// ─── Mapper ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPortfolio(r: Record<string, any>): ClientPortfolio {
  return {
    id:              r.id,
    clientId:        r.client_id,
    clientName:      r.client_name,
    name:            r.name,
    description:     r.description ?? '',
    holdings:        (r.holdings        as ClientHolding[])     ?? [],
    transactions:    (r.transactions    as ClientTransaction[]) ?? [],
    advisorNotes:    (r.advisor_notes   as AdvisorNote[])       ?? [],
    recommendations: r.recommendations ?? '',
    createdAt:       r.created_at,
    updatedAt:       r.updated_at,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getAllClientPortfolios(): Promise<ClientPortfolio[]> {
  const db = getDb();
  if (!db) return [..._db].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const { data, error } = await db.from('client_portfolios').select('*').order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPortfolio);
}

export async function getPortfolioByClientId(clientId: string): Promise<ClientPortfolio | null> {
  const db = getDb();
  if (!db) return _db.find(p => p.clientId === clientId) ?? null;
  const { data, error } = await db.from('client_portfolios').select('*').eq('client_id', clientId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToPortfolio(data) : null;
}

export async function getPortfolioById(id: string): Promise<ClientPortfolio | null> {
  const db = getDb();
  if (!db) return _db.find(p => p.id === id) ?? null;
  const { data, error } = await db.from('client_portfolios').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToPortfolio(data) : null;
}

export async function createClientPortfolio(
  input: Pick<ClientPortfolio, 'clientId' | 'clientName' | 'name' | 'description' | 'recommendations'>
): Promise<ClientPortfolio> {
  const now = new Date().toISOString().split('T')[0];
  const portfolio: ClientPortfolio = {
    ...input,
    id:           `cport-${Date.now()}`,
    holdings:     [],
    transactions: [],
    advisorNotes: [],
    createdAt:    now,
    updatedAt:    now,
  };
  const db = getDb();
  if (!db) { _db.push(portfolio); return portfolio; }
  const { error } = await db.from('client_portfolios').insert({
    id: portfolio.id, client_id: portfolio.clientId, client_name: portfolio.clientName,
    name: portfolio.name, description: portfolio.description,
    holdings: [], transactions: [], advisor_notes: [],
    recommendations: portfolio.recommendations,
    created_at: portfolio.createdAt, updated_at: portfolio.updatedAt,
  });
  if (error) throw new Error(error.message);
  return portfolio;
}

export async function updateClientPortfolio(
  id: string,
  updates: Partial<Omit<ClientPortfolio, 'id' | 'clientId' | 'createdAt'>>
): Promise<ClientPortfolio | null> {
  const now = new Date().toISOString().split('T')[0];
  const db  = getDb();
  if (!db) {
    const idx = _db.findIndex(p => p.id === id);
    if (idx === -1) return null;
    _db[idx] = { ..._db[idx], ...updates, updatedAt: now };
    return _db[idx];
  }
  const patch: Record<string, unknown> = { updated_at: now };
  const map: Record<string, string> = {
    name: 'name', description: 'description', recommendations: 'recommendations',
    holdings: 'holdings', transactions: 'transactions', advisorNotes: 'advisor_notes',
    clientName: 'client_name',
  };
  for (const [k, col] of Object.entries(map)) {
    if (k in updates) patch[col] = updates[k as keyof typeof updates];
  }
  const { data, error } = await db.from('client_portfolios').update(patch).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToPortfolio(data) : null;
}

export async function deleteClientPortfolio(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const idx = _db.findIndex(p => p.id === id);
    if (idx === -1) return false;
    _db.splice(idx, 1);
    return true;
  }
  const { error } = await db.from('client_portfolios').delete().eq('id', id);
  return !error;
}

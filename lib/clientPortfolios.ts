import { getDb } from './supabase';

// Sufix aleatori per evitar IDs repetits quan s'afegeixen moltes files en el
// mateix mil·lisegon (p. ex. una importació d'Excel).
const rid = () => globalThis.crypto.randomUUID().slice(0, 8);

export type OperationType = 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'rebalance';

export interface ClientHolding {
  id:               string;
  portfolioId:      string;
  assetIsin:        string;
  assetName:        string;
  assetSymbol?:     string;
  assetCategory:    string;
  broker:           string;
  quantity:         number;
  avgEntryPrice:    number;
  currentPrice:     number;
  priceLastUpdated: string;
  priceSource?:     'fmp' | 'manual' | 'pending';
  currency:         string;
  notes?:           string;
  createdAt:        string;
}

export interface ClientTransaction {
  id:            string;
  portfolioId:   string;
  holdingId?:    string;
  operationType: OperationType;
  ticker?:       string;
  assetName?:    string;
  date:          string;
  quantity:      number;
  priceEur:      number;
  totalEur:      number;
  commission:    number;
  broker:        string;
  notes?:        string;
  createdAt:     string;
}

export interface PortfolioSnapshot {
  id:          string;
  portfolioId: string;
  date:        string;
  totalValue:  number;
  notes?:      string;
  createdBy:   string;
  createdAt:   string;
}

export interface AdvisorNote {
  id:                string;
  portfolioId:       string;
  text:              string;
  author:            string;
  isVisibleToClient: boolean;
  createdAt:         string;
}

export interface ClientPortfolio {
  id:              string;
  clientId:        string;
  clientName:      string;
  name:            string;
  description:     string;
  recommendations: string;
  nextFollowup?:   string;
  holdings:        ClientHolding[];
  transactions:    ClientTransaction[];
  advisorNotes:    AdvisorNote[];
  snapshots:       PortfolioSnapshot[];
  createdAt:       string;
  updatedAt:       string;
}

export interface PortfolioMetrics {
  totalInvested:    number;
  currentValue:     number;
  netContributions: number;
  pnlEur:           number;
  pnlPct:           number;
  holdingCount:     number;
  lastUpdated:      string | null;
}

/**
 * Posició venuda del tot: 0 participacions i alguna venda registrada.
 * No és una "proposta pendent de compra" (0 participacions sense cap venda).
 */
export function isSoldOut(h: Pick<ClientHolding, 'id' | 'quantity'>, transactions: Pick<ClientTransaction, 'holdingId' | 'operationType'>[]): boolean {
  return h.quantity <= 1e-9 && transactions.some(t => t.holdingId === h.id && t.operationType === 'sell');
}

export function computeMetrics(p: ClientPortfolio): PortfolioMetrics {
  const currentValue = p.holdings.reduce((s, h) => s + h.currentPrice * h.quantity, 0);

  // Aportacions netes. Una compra pagada amb diners ja aportats abans ("Aportació"
  // i després "Compra", com fa el client a l'Excel) no torna a comptar: abans
  // es comptava dues vegades i una cartera sense guanys sortia amb un -50 %.
  let netContributions = 0;
  let hasTransactions  = false;
  let depositedCash    = 0;   // aportat i encara no invertit
  const ORDER: Record<string, number> = { deposit: 0, withdrawal: 1, sell: 2, buy: 3 };
  const txs = [...p.transactions].sort((a, b) =>
    a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) || (ORDER[a.operationType] ?? 9) - (ORDER[b.operationType] ?? 9));
  for (const tx of txs) {
    if (tx.operationType === 'deposit') {
      netContributions += tx.totalEur; depositedCash += tx.totalEur; hasTransactions = true;
    }
    if (tx.operationType === 'withdrawal') {
      netContributions -= tx.totalEur; depositedCash = Math.max(0, depositedCash - tx.totalEur); hasTransactions = true;
    }
    if (tx.operationType === 'buy') {
      const cost = tx.totalEur + tx.commission;
      const fromDeposits = Math.min(depositedCash, cost);
      depositedCash -= fromDeposits;
      netContributions += cost - fromDeposits; hasTransactions = true;
    }
    if (tx.operationType === 'sell') { netContributions -= tx.totalEur - tx.commission; hasTransactions = true; }
  }
  const totalInvested = hasTransactions
    ? netContributions
    : p.holdings.reduce((s, h) => s + h.avgEntryPrice * h.quantity, 0);

  const pnlEur    = currentValue - totalInvested;
  const lastUpdated = p.holdings.length > 0
    ? p.holdings.reduce((best, h) => (h.priceLastUpdated > best ? h.priceLastUpdated : best), '')
    : null;

  return {
    totalInvested:    Math.round(totalInvested    * 100) / 100,
    currentValue:     Math.round(currentValue     * 100) / 100,
    netContributions: Math.round(netContributions * 100) / 100,
    pnlEur:           Math.round(pnlEur           * 100) / 100,
    pnlPct:           totalInvested > 0 ? Math.round((pnlEur / totalInvested) * 10000) / 100 : 0,
    holdingCount:     p.holdings.filter(h => h.quantity > 0).length,   // les venudes del tot no compten
    lastUpdated:      lastUpdated || null,
  };
}

// ─── In-memory store ──────────────────────────────────────────────────────────

let _portfolios: ClientPortfolio[] = [];

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToPortfolio(r: Record<string, unknown>): ClientPortfolio {
  return {
    id:              r.id as string,
    clientId:        r.client_id as string,
    clientName:      r.client_name as string,
    name:            r.name as string,
    description:     (r.description as string) ?? '',
    recommendations: (r.recommendations as string) ?? '',
    nextFollowup:    r.next_followup as string | undefined,
    holdings:        [],
    transactions:    [],
    advisorNotes:    [],
    snapshots:       [],
    createdAt:       r.created_at as string,
    updatedAt:       r.updated_at as string,
  };
}

function rowToHolding(r: Record<string, unknown>): ClientHolding {
  return {
    id:               r.id as string,
    portfolioId:      r.portfolio_id as string,
    assetIsin:        (r.asset_isin as string) ?? '',
    assetName:        r.asset_name as string,
    assetSymbol:      r.asset_symbol as string | undefined,
    assetCategory:    (r.asset_category as string) ?? '',
    broker:           (r.broker as string) ?? '',
    quantity:         Number(r.quantity),
    avgEntryPrice:    Number(r.avg_entry_price),
    currentPrice:     Number(r.current_price),
    priceLastUpdated: (r.price_last_updated as string) ?? '',
    priceSource:      (r.price_source as 'fmp' | 'manual' | 'pending') || undefined,
    currency:         (r.currency as string) ?? 'EUR',
    notes:            r.notes as string | undefined,
    createdAt:        r.created_at as string,
  };
}

function rowToTransaction(r: Record<string, unknown>): ClientTransaction {
  return {
    id:            r.id as string,
    portfolioId:   r.portfolio_id as string,
    holdingId:     r.holding_id as string | undefined,
    operationType: r.operation_type as OperationType,
    ticker:        r.ticker as string | undefined,
    assetName:     r.asset_name as string | undefined,
    date:          r.date as string,
    quantity:      Number(r.quantity),
    priceEur:      Number(r.price_eur),
    totalEur:      Number(r.total_eur),
    commission:    Number(r.commission),
    broker:        (r.broker as string) ?? '',
    notes:         r.notes as string | undefined,
    createdAt:     r.created_at as string,
  };
}

function rowToSnapshot(r: Record<string, unknown>): PortfolioSnapshot {
  return {
    id:          r.id as string,
    portfolioId: r.portfolio_id as string,
    date:        r.date as string,
    totalValue:  Number(r.total_value),
    notes:       r.notes as string | undefined,
    createdBy:   (r.created_by as string) ?? 'admin',
    createdAt:   r.created_at as string,
  };
}

function rowToNote(r: Record<string, unknown>): AdvisorNote {
  return {
    id:                r.id as string,
    portfolioId:       r.portfolio_id as string,
    text:              r.text as string,
    author:            (r.author as string) ?? 'Admin',
    isVisibleToClient: Boolean(r.is_visible_to_client),
    createdAt:         r.created_at as string,
  };
}

// ─── Supabase relation loader ─────────────────────────────────────────────────

async function loadPortfolioRelations(
  p: ClientPortfolio,
  db: ReturnType<typeof getDb>,
): Promise<ClientPortfolio> {
  if (!db) return p;
  const [h, t, n, s] = await Promise.all([
    db.from('client_holdings').select('*').eq('portfolio_id', p.id).order('created_at'),
    db.from('client_transactions').select('*').eq('portfolio_id', p.id).order('date', { ascending: false }),
    db.from('advisor_notes').select('*').eq('portfolio_id', p.id).order('created_at', { ascending: false }),
    db.from('portfolio_snapshots').select('*').eq('portfolio_id', p.id).order('date', { ascending: false }),
  ]);
  return {
    ...p,
    holdings:     (h.data ?? []).map(r => rowToHolding(r as Record<string, unknown>)),
    transactions: (t.data ?? []).map(r => rowToTransaction(r as Record<string, unknown>)),
    advisorNotes: (n.data ?? []).map(r => rowToNote(r as Record<string, unknown>)),
    snapshots:    (s.data ?? []).map(r => rowToSnapshot(r as Record<string, unknown>)),
  };
}

// ─── Portfolio CRUD ───────────────────────────────────────────────────────────

export async function getAllClientPortfolios(): Promise<ClientPortfolio[]> {
  const db = getDb();
  if (!db) return [..._portfolios].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const { data, error } = await db.from('client_portfolios').select('*').order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return Promise.all((data ?? []).map(r => loadPortfolioRelations(rowToPortfolio(r as Record<string, unknown>), db)));
}

export async function getPortfolioByClientId(clientId: string): Promise<ClientPortfolio | null> {
  const db = getDb();
  if (!db) return _portfolios.find(p => p.clientId === clientId) ?? null;
  const { data, error } = await db.from('client_portfolios').select('*').eq('client_id', clientId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return loadPortfolioRelations(rowToPortfolio(data as Record<string, unknown>), db);
}

export async function getPortfolioById(id: string): Promise<ClientPortfolio | null> {
  const db = getDb();
  if (!db) return _portfolios.find(p => p.id === id) ?? null;
  const { data, error } = await db.from('client_portfolios').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return loadPortfolioRelations(rowToPortfolio(data as Record<string, unknown>), db);
}

export async function createClientPortfolio(
  input: Pick<ClientPortfolio, 'clientId' | 'clientName' | 'name' | 'description' | 'recommendations'>,
): Promise<ClientPortfolio> {
  const now = new Date().toISOString();
  const portfolio: ClientPortfolio = {
    ...input, id: `cport-${Date.now()}-${rid()}`, nextFollowup: undefined,
    holdings: [], transactions: [], advisorNotes: [], snapshots: [],
    createdAt: now, updatedAt: now,
  };
  const db = getDb();
  if (!db) { _portfolios.push(portfolio); return portfolio; }
  const { error } = await db.from('client_portfolios').insert({
    id: portfolio.id, client_id: portfolio.clientId, client_name: portfolio.clientName,
    name: portfolio.name, description: portfolio.description,
    recommendations: portfolio.recommendations,
    created_at: portfolio.createdAt, updated_at: portfolio.updatedAt,
  });
  if (error) throw new Error(error.message);
  return portfolio;
}

/**
 * Reserva la cartera per a una operació de diverses escriptures (p. ex. una
 * reestructuració): només funciona si ningú no l'ha modificada des que es va
 * llegir (updated_at igual). Dues reestructuracions alhora: només una passa.
 */
export async function claimPortfolio(id: string, expectedUpdatedAt: string): Promise<boolean> {
  // Sempre una marca diferent de la llegida (encara que sigui el mateix mil·lisegon).
  const t = Date.now();
  const now = new Date(Date.parse(expectedUpdatedAt) >= t ? Date.parse(expectedUpdatedAt) + 1 : t).toISOString();
  const db  = getDb();
  if (!db) {
    const p = _portfolios.find(x => x.id === id);
    if (!p || p.updatedAt !== expectedUpdatedAt) return false;
    p.updatedAt = now;
    return true;
  }
  const { data, error } = await db.from('client_portfolios')
    .update({ updated_at: now }).eq('id', id).eq('updated_at', expectedUpdatedAt).select('id');
  if (error) throw new Error(error.message);
  return !!data?.length;
}

export async function updatePortfolioMeta(
  id: string,
  updates: { name?: string; description?: string; recommendations?: string; nextFollowup?: string },
): Promise<ClientPortfolio | null> {
  const now = new Date().toISOString();
  const db  = getDb();
  if (!db) {
    const idx = _portfolios.findIndex(p => p.id === id);
    if (idx === -1) return null;
    _portfolios[idx] = { ..._portfolios[idx], ...updates, updatedAt: now };
    return _portfolios[idx];
  }
  const patch: Record<string, unknown> = { updated_at: now };
  if (updates.name            !== undefined) patch.name             = updates.name;
  if (updates.description     !== undefined) patch.description      = updates.description;
  if (updates.recommendations !== undefined) patch.recommendations  = updates.recommendations;
  if (updates.nextFollowup    !== undefined) patch.next_followup    = updates.nextFollowup;
  await db.from('client_portfolios').update(patch).eq('id', id);
  return getPortfolioById(id);
}

export async function deleteClientPortfolio(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const idx = _portfolios.findIndex(p => p.id === id);
    if (idx === -1) return false;
    _portfolios.splice(idx, 1);
    return true;
  }
  const { error } = await db.from('client_portfolios').delete().eq('id', id);
  return !error;
}

// backward compat shim used by old admin route
export async function updateClientPortfolio(
  id: string,
  updates: Partial<ClientPortfolio>,
): Promise<ClientPortfolio | null> {
  return updatePortfolioMeta(id, {
    name:            updates.name,
    description:     updates.description,
    recommendations: updates.recommendations,
    nextFollowup:    updates.nextFollowup,
  });
}

// ─── Holdings ─────────────────────────────────────────────────────────────────

export async function addHolding(
  portfolioId: string,
  h: Omit<ClientHolding, 'id' | 'portfolioId' | 'createdAt'>,
): Promise<ClientHolding> {
  const now  = new Date().toISOString();
  const newH: ClientHolding = { ...h, id: `h-${Date.now()}-${rid()}`, portfolioId, createdAt: now };
  const db   = getDb();
  if (!db) {
    const p = _portfolios.find(p => p.id === portfolioId);
    if (p) { p.holdings.push(newH); p.updatedAt = now; }
    return newH;
  }
  const { error } = await db.from('client_holdings').insert({
    id: newH.id, portfolio_id: portfolioId,
    asset_isin: h.assetIsin, asset_name: h.assetName, asset_symbol: h.assetSymbol ?? null,
    asset_category: h.assetCategory, broker: h.broker, quantity: h.quantity,
    avg_entry_price: h.avgEntryPrice, current_price: h.currentPrice,
    price_last_updated: h.priceLastUpdated, price_source: h.priceSource ?? 'pending',
    currency: h.currency, notes: h.notes ?? null,
    created_at: now,
  });
  if (error) throw new Error(error.message);
  await db.from('client_portfolios').update({ updated_at: now }).eq('id', portfolioId);
  return newH;
}

export async function updateHoldingPrice(
  holdingId: string,
  portfolioId: string,
  currentPrice: number,
  priceSource: 'fmp' | 'manual' = 'manual',
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const db    = getDb();
  if (!db) {
    const p = _portfolios.find(p => p.id === portfolioId);
    const h = p?.holdings.find(h => h.id === holdingId);
    if (h) { h.currentPrice = currentPrice; h.priceLastUpdated = today; h.priceSource = priceSource; }
    return;
  }
  await db.from('client_holdings').update({ current_price: currentPrice, price_last_updated: today, price_source: priceSource }).eq('id', holdingId);
  await db.from('client_portfolios').update({ updated_at: new Date().toISOString() }).eq('id', portfolioId);
}

type NavRef = { isin: string; date: string; nav: number; currency: string };
type HoldingPriceView = Pick<ClientHolding, 'assetIsin' | 'currency' | 'priceLastUpdated' | 'priceSource'>;
type PriceUpdate = { currentPrice?: number; priceLastUpdated?: string; priceSource: 'manual' | 'pending' };

/** Aplica `decide` a les posicions dels ISIN donats (Supabase o memòria). Retorna quantes canvia. */
async function applyToHoldings(isins: string[], decide: (h: HoldingPriceView) => PriceUpdate | null): Promise<number> {
  if (!isins.length) return 0;
  const db = getDb();
  let n = 0;
  if (!db) {
    for (const p of _portfolios) for (const h of p.holdings) {
      if (!isins.includes((h.assetIsin ?? '').toUpperCase())) continue;
      const u = decide(h);
      if (!u) continue;
      if (u.currentPrice !== undefined) h.currentPrice = u.currentPrice;
      if (u.priceLastUpdated !== undefined) h.priceLastUpdated = u.priceLastUpdated;
      h.priceSource = u.priceSource; n++;
    }
    return n;
  }
  const { data, error } = await db.from('client_holdings')
    .select('id,portfolio_id,asset_isin,currency,price_last_updated,price_source').in('asset_isin', isins);
  if (error) throw new Error(error.message);
  const touched = new Set<string>();
  for (const r of data ?? []) {
    const u = decide({
      assetIsin: String(r.asset_isin), currency: String(r.currency ?? 'EUR'),
      priceLastUpdated: String(r.price_last_updated ?? ''), priceSource: (r.price_source as ClientHolding['priceSource']) || undefined,
    });
    if (!u) continue;
    const row: Record<string, unknown> = { price_source: u.priceSource };
    if (u.currentPrice !== undefined) row.current_price = u.currentPrice;
    if (u.priceLastUpdated !== undefined) row.price_last_updated = u.priceLastUpdated;
    const { error: e } = await db.from('client_holdings').update(row).eq('id', r.id);
    if (e) throw new Error(e.message);
    touched.add(String(r.portfolio_id)); n++;
  }
  if (touched.size) await db.from('client_portfolios').update({ updated_at: new Date().toISOString() }).in('id', [...touched]);
  return n;
}

const sameCurrency = (h: HoldingPriceView, l: NavRef) => (h.currency || 'EUR').toUpperCase() === l.currency.toUpperCase();

/**
 * Posa a les posicions dels clients l'últim valor liquidatiu entrat a mà
 * (lib/fundNavs.ts). Només si la moneda coincideix i el preu que tenen és
 * més antic o encara és provisional ('pending', p. ex. el preu de compra
 * d'una importació): mai no es trepitja un preu real més recent.
 */
export async function syncHoldingsToNavs(latest: NavRef[]): Promise<number> {
  const byIsin = new Map(latest.map(l => [l.isin.toUpperCase(), l]));
  return applyToHoldings([...byIsin.keys()], h => {
    const l = byIsin.get((h.assetIsin ?? '').toUpperCase());
    if (!l || !sameCurrency(h, l)) return null;
    const older = (h.priceLastUpdated ?? '').slice(0, 10) <= l.date;
    return h.priceSource === 'pending' || older ? { currentPrice: l.nav, priceLastUpdated: l.date, priceSource: 'manual' } : null;
  });
}

/**
 * Després d'esborrar preus d'un fons: les posicions que feien servir un preu
 * esborrat (manual, de la data esborrada o de qualsevol data si s'han esborrat
 * tots) passen a l'últim preu que queda o, si no n'hi ha, a 'pending'.
 */
export async function reconcileHoldingsAfterNavDelete(isin: string, deletedDate: string | undefined, latest: NavRef | null): Promise<number> {
  const up = isin.toUpperCase();
  return applyToHoldings([up], h => {
    if (h.priceSource !== 'manual') return null;
    if (deletedDate && (h.priceLastUpdated ?? '').slice(0, 10) !== deletedDate) return null;
    if (latest && sameCurrency(h, latest)) return { currentPrice: latest.nav, priceLastUpdated: latest.date, priceSource: 'manual' };
    return { priceSource: 'pending' };
  });
}

export async function updateHolding(holdingId: string, portfolioId: string, updates: Partial<ClientHolding>): Promise<void> {
  const now = new Date().toISOString();
  const db  = getDb();
  if (!db) {
    const p = _portfolios.find(p => p.id === portfolioId);
    if (p) {
      const idx = p.holdings.findIndex(h => h.id === holdingId);
      if (idx > -1) p.holdings[idx] = { ...p.holdings[idx], ...updates };
    }
    return;
  }
  const col: Record<string, string> = {
    assetIsin: 'asset_isin', assetName: 'asset_name', assetSymbol: 'asset_symbol',
    assetCategory: 'asset_category', broker: 'broker', quantity: 'quantity',
    avgEntryPrice: 'avg_entry_price', currentPrice: 'current_price',
    priceLastUpdated: 'price_last_updated', currency: 'currency', notes: 'notes',
  };
  const patch: Record<string, unknown> = {};
  for (const [k, c] of Object.entries(col)) {
    if (k in updates) patch[c] = updates[k as keyof typeof updates];
  }
  const { error } = await db.from('client_holdings').update(patch).eq('id', holdingId);
  if (error) throw new Error(error.message);
  await db.from('client_portfolios').update({ updated_at: now }).eq('id', portfolioId);
}

export async function removeHolding(holdingId: string, portfolioId: string): Promise<void> {
  const db = getDb();
  if (!db) {
    const p = _portfolios.find(p => p.id === portfolioId);
    if (p) p.holdings = p.holdings.filter(h => h.id !== holdingId);
    return;
  }
  await db.from('client_holdings').delete().eq('id', holdingId);
  await db.from('client_portfolios').update({ updated_at: new Date().toISOString() }).eq('id', portfolioId);
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function addTransaction(
  portfolioId: string,
  tx: Omit<ClientTransaction, 'id' | 'portfolioId' | 'createdAt'>,
): Promise<ClientTransaction> {
  const now  = new Date().toISOString();
  const newTx: ClientTransaction = { ...tx, id: `tx-${Date.now()}-${rid()}`, portfolioId, createdAt: now };
  const db   = getDb();
  if (!db) {
    const p = _portfolios.find(p => p.id === portfolioId);
    if (p) { p.transactions.push(newTx); p.updatedAt = now; }
    return newTx;
  }
  const { error } = await db.from('client_transactions').insert({
    id: newTx.id, portfolio_id: portfolioId, holding_id: tx.holdingId ?? null,
    operation_type: tx.operationType, ticker: tx.ticker ?? null, asset_name: tx.assetName ?? null,
    date: tx.date, quantity: tx.quantity, price_eur: tx.priceEur,
    total_eur: tx.totalEur, commission: tx.commission, broker: tx.broker, notes: tx.notes ?? null,
    created_at: now,
  });
  if (error) throw new Error(error.message);
  await db.from('client_portfolios').update({ updated_at: now }).eq('id', portfolioId);
  return newTx;
}

export async function removeTransaction(txId: string, portfolioId: string): Promise<void> {
  const db = getDb();
  if (!db) {
    const p = _portfolios.find(p => p.id === portfolioId);
    if (p) p.transactions = p.transactions.filter(t => t.id !== txId);
    return;
  }
  await db.from('client_transactions').delete().eq('id', txId);
  await db.from('client_portfolios').update({ updated_at: new Date().toISOString() }).eq('id', portfolioId);
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

export async function addSnapshot(
  portfolioId: string,
  snap: { date: string; totalValue: number; notes?: string; createdBy?: string },
): Promise<PortfolioSnapshot> {
  const now    = new Date().toISOString();
  const newSnap: PortfolioSnapshot = {
    id: `snap-${Date.now()}-${rid()}`, portfolioId,
    date: snap.date, totalValue: snap.totalValue,
    notes: snap.notes, createdBy: snap.createdBy ?? 'admin', createdAt: now,
  };
  const db = getDb();
  if (!db) {
    const p = _portfolios.find(p => p.id === portfolioId);
    if (p) {
      p.snapshots = [...p.snapshots.filter(s => s.date !== snap.date), newSnap]
        .sort((a, b) => b.date.localeCompare(a.date));
      p.updatedAt = now;
    }
    return newSnap;
  }
  await db.from('portfolio_snapshots').upsert({
    id: newSnap.id, portfolio_id: portfolioId, date: snap.date,
    total_value: snap.totalValue, notes: snap.notes ?? null,
    created_by: snap.createdBy ?? 'admin', created_at: now,
  }, { onConflict: 'portfolio_id,date' });
  await db.from('client_portfolios').update({ updated_at: now }).eq('id', portfolioId);
  return newSnap;
}

export async function removeSnapshot(snapId: string, portfolioId: string): Promise<void> {
  const db = getDb();
  if (!db) {
    const p = _portfolios.find(p => p.id === portfolioId);
    if (p) p.snapshots = p.snapshots.filter(s => s.id !== snapId);
    return;
  }
  await db.from('portfolio_snapshots').delete().eq('id', snapId);
  await db.from('client_portfolios').update({ updated_at: new Date().toISOString() }).eq('id', portfolioId);
}

// ─── Advisor Notes ────────────────────────────────────────────────────────────

export async function addAdvisorNote(
  portfolioId: string,
  note: { text: string; author?: string; isVisibleToClient?: boolean },
): Promise<AdvisorNote> {
  const now     = new Date().toISOString();
  const newNote: AdvisorNote = {
    id: `note-${Date.now()}-${rid()}`, portfolioId,
    text: note.text, author: note.author ?? 'Admin Factor OTC',
    isVisibleToClient: note.isVisibleToClient ?? true, createdAt: now,
  };
  const db = getDb();
  if (!db) {
    const p = _portfolios.find(p => p.id === portfolioId);
    if (p) { p.advisorNotes.unshift(newNote); p.updatedAt = now; }
    return newNote;
  }
  const { error } = await db.from('advisor_notes').insert({
    id: newNote.id, portfolio_id: portfolioId, text: note.text,
    author: note.author ?? 'Admin Factor OTC',
    is_visible_to_client: note.isVisibleToClient ?? true, created_at: now,
  });
  if (error) throw new Error(error.message);
  await db.from('client_portfolios').update({ updated_at: now }).eq('id', portfolioId);
  return newNote;
}

export async function updateAdvisorNote(
  noteId: string,
  portfolioId: string,
  updates: { text?: string; isVisibleToClient?: boolean },
): Promise<void> {
  const db = getDb();
  if (!db) {
    const p = _portfolios.find(p => p.id === portfolioId);
    if (p) { const n = p.advisorNotes.find(n => n.id === noteId); if (n) Object.assign(n, updates); }
    return;
  }
  const patch: Record<string, unknown> = {};
  if (updates.text !== undefined) patch.text = updates.text;
  if (updates.isVisibleToClient !== undefined) patch.is_visible_to_client = updates.isVisibleToClient;
  await db.from('advisor_notes').update(patch).eq('id', noteId);
}

export async function removeAdvisorNote(noteId: string, portfolioId: string): Promise<void> {
  const db = getDb();
  if (!db) {
    const p = _portfolios.find(p => p.id === portfolioId);
    if (p) p.advisorNotes = p.advisorNotes.filter(n => n.id !== noteId);
    return;
  }
  await db.from('advisor_notes').delete().eq('id', noteId);
}

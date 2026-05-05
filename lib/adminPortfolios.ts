import { getDb } from './supabase';
import type { InvestorProfile } from './products';

export type AssetType = 'fund' | 'etf' | 'stock';
export type PortfolioStatus = 'draft' | 'active' | 'archived';

export interface PortfolioAsset {
  type:          AssetType;
  id:            string;
  name:          string;
  isin?:         string;
  symbol?:       string;
  weight:        number;
  justification: string;
}

export interface AdminPortfolio {
  id:                 string;
  name:               string;
  description:        string;
  recommendedProfile: InvestorProfile;
  horizon:            string;
  assets:             PortfolioAsset[];
  totalWeight:        number;
  expectedReturn:     number | null;
  expectedVol:        number | null;
  justification:      string;
  status:             PortfolioStatus;
  createdAt:          string;
  updatedAt:          string;
}

export const HORIZON_OPTIONS = ['1–3 anys', '3–5 anys', '5–10 anys', '10+ anys'];

// ── In-memory fallback (dev sense Supabase) ────────────────────────────────

const SAMPLE_PORTFOLIOS: AdminPortfolio[] = [
  {
    id: 'port-conservador-model',
    name: 'Cartera Conservadora Model',
    description: 'Cartera de baix risc per a preservació de capital amb rendiment modest.',
    recommendedProfile: 'conservador',
    horizon: '3–5 anys',
    assets: [
      { type: 'fund', id: 'amundi-monetari-eur',      name: 'Amundi Euro Liquidity SRI',  isin: 'FR0010510008', weight: 20, justification: 'Component de liquiditat i baix risc' },
      { type: 'fund', id: 'pimco-rf-curta',            name: 'PIMCO Euro Short-Term',       isin: 'IE00B11XZ871', weight: 25, justification: 'Renda fixa curta durada, risc mínim' },
      { type: 'etf',  id: 'ishares-global-agg-bond-etf', name: 'iShares Global Agg Bond ETF', isin: 'IE00B3F81R35', weight: 30, justification: 'Diversificació RF global hedged EUR' },
      { type: 'fund', id: 'nordea-stable-return',      name: 'Nordea Stable Return',        isin: 'LU0141799501', weight: 15, justification: 'Mixt defensiu amb baixa volatilitat' },
      { type: 'etf',  id: 'ishares-core-europe-etf',   name: 'iShares Core Europe ETF',     isin: 'IE00B4K48X80', weight: 10, justification: 'Component RV Europa mínima' },
    ],
    totalWeight: 100, expectedReturn: 3.2, expectedVol: 4.5,
    justification: 'Cartera orientada a preservació de capital amb exposició molt limitada a renda variable.',
    status: 'active', createdAt: '2026-04-01', updatedAt: '2026-04-28',
  },
  {
    id: 'port-moderat-model',
    name: 'Cartera Moderada Model',
    description: 'Equilibri entre creixement i estabilitat. Base indexada amb component actiu selectiu.',
    recommendedProfile: 'moderat',
    horizon: '5–10 anys',
    assets: [
      { type: 'etf',  id: 'ishares-msci-world-etf',      name: 'iShares MSCI World ETF',   isin: 'IE00B4L5Y983', weight: 35, justification: 'Core RV global indexat, màxima diversificació' },
      { type: 'etf',  id: 'ishares-global-agg-bond-etf', name: 'iShares Global Agg Bond',  isin: 'IE00B3F81R35', weight: 25, justification: 'Component defensiu RF global' },
      { type: 'fund', id: 'flossbach-multiple-opp',       name: 'Flossbach Multiple Opp.', isin: 'LU0323578657', weight: 20, justification: 'Mixt flexible de referència, gestió activa de qualitat' },
      { type: 'etf',  id: 'ishares-msci-em-etf',          name: 'iShares MSCI EM ETF',     isin: 'IE00BKM4GZ66', weight: 10, justification: 'Component emergents per diversificació global' },
      { type: 'fund', id: 'fidelity-dividend',            name: 'Fidelity Global Dividend', isin: 'LU0605515377', weight: 10, justification: 'Income i dividend per estabilitzar retorns' },
    ],
    totalWeight: 100, expectedReturn: 7.1, expectedVol: 9.8,
    justification: 'Cartera balancejada amb base indexada (60% RV/RF) i complement actiu selectiu.',
    status: 'active', createdAt: '2026-04-01', updatedAt: '2026-04-28',
  },
];

let _memDB: AdminPortfolio[] = [...SAMPLE_PORTFOLIOS];

// ── Utilitats ──────────────────────────────────────────────────────────────

export function recalcTotalWeight(assets: PortfolioAsset[]): number {
  return Math.round(assets.reduce((s, a) => s + a.weight, 0) * 100) / 100;
}

export function estimateMetrics(assets: PortfolioAsset[]): { expectedReturn: number; expectedVol: number } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FINANCIAL_PRODUCTS } = require('./products');
    let retSum = 0, volSum = 0, wSum = 0;
    for (const a of assets) {
      const p = FINANCIAL_PRODUCTS.find((x: { id: string }) => x.id === a.id);
      if (p?.historicalReturn5Y && p?.historicalVolatility) {
        const w = a.weight / 100;
        retSum += p.historicalReturn5Y   * w;
        volSum += p.historicalVolatility * w;
        wSum   += w;
      }
    }
    if (wSum > 0) return {
      expectedReturn: Math.round(retSum * 10) / 10,
      expectedVol:    Math.round(volSum * 10) / 10,
    };
  } catch { /* ok */ }
  return { expectedReturn: 0, expectedVol: 0 };
}

// ── Mapper DB → TS ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPortfolio(row: Record<string, any>): AdminPortfolio {
  return {
    id:                 row.id,
    name:               row.name,
    description:        row.description,
    recommendedProfile: row.recommended_profile as InvestorProfile,
    horizon:            row.horizon,
    assets:             row.assets as PortfolioAsset[],
    totalWeight:        Number(row.total_weight),
    expectedReturn:     row.expected_return != null ? Number(row.expected_return) : null,
    expectedVol:        row.expected_vol    != null ? Number(row.expected_vol)    : null,
    justification:      row.justification,
    status:             row.status as PortfolioStatus,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  };
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function getAllPortfolios(): Promise<AdminPortfolio[]> {
  const db = getDb();
  if (!db) return [..._memDB].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const { data, error } = await db.from('portfolios').select('*').order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPortfolio);
}

export async function getPortfolioById(id: string): Promise<AdminPortfolio | null> {
  const db = getDb();
  if (!db) return _memDB.find(p => p.id === id) ?? null;

  const { data, error } = await db.from('portfolios').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToPortfolio(data) : null;
}

export async function getActivePortfolios(): Promise<AdminPortfolio[]> {
  const db = getDb();
  if (!db) return _memDB.filter(p => p.status === 'active');

  const { data, error } = await db.from('portfolios').select('*').eq('status', 'active');
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPortfolio);
}

export async function createPortfolio(
  data: Omit<AdminPortfolio, 'id' | 'totalWeight' | 'expectedReturn' | 'expectedVol' | 'createdAt' | 'updatedAt'>
): Promise<AdminPortfolio> {
  const now     = new Date().toISOString().split('T')[0];
  const metrics = estimateMetrics(data.assets);
  const portfolio: AdminPortfolio = {
    ...data,
    id:             `port-${Date.now()}`,
    totalWeight:    recalcTotalWeight(data.assets),
    expectedReturn: metrics.expectedReturn || null,
    expectedVol:    metrics.expectedVol    || null,
    createdAt:      now,
    updatedAt:      now,
  };

  const db = getDb();
  if (!db) { _memDB.push(portfolio); return portfolio; }

  const { error } = await db.from('portfolios').insert({
    id:                  portfolio.id,
    name:                portfolio.name,
    description:         portfolio.description,
    recommended_profile: portfolio.recommendedProfile,
    horizon:             portfolio.horizon,
    assets:              portfolio.assets,
    total_weight:        portfolio.totalWeight,
    expected_return:     portfolio.expectedReturn,
    expected_vol:        portfolio.expectedVol,
    justification:       portfolio.justification,
    status:              portfolio.status,
    created_at:          portfolio.createdAt,
    updated_at:          portfolio.updatedAt,
  });
  if (error) throw new Error(error.message);
  return portfolio;
}

export async function updatePortfolio(
  id: string,
  updates: Partial<Omit<AdminPortfolio, 'id' | 'createdAt'>>
): Promise<AdminPortfolio | null> {
  const db     = getDb();
  const now    = new Date().toISOString().split('T')[0];
  const assets = updates.assets;

  if (!db) {
    const idx = _memDB.findIndex(p => p.id === id);
    if (idx === -1) return null;
    const metrics = assets ? estimateMetrics(assets) : { expectedReturn: 0, expectedVol: 0 };
    _memDB[idx] = {
      ..._memDB[idx], ...updates,
      assets:         assets ?? _memDB[idx].assets,
      totalWeight:    recalcTotalWeight(assets ?? _memDB[idx].assets),
      expectedReturn: metrics.expectedReturn || _memDB[idx].expectedReturn,
      expectedVol:    metrics.expectedVol    || _memDB[idx].expectedVol,
      updatedAt:      now,
    };
    return _memDB[idx];
  }

  const patch: Record<string, unknown> = { updated_at: now };
  if (updates.name               !== undefined) patch.name                = updates.name;
  if (updates.description        !== undefined) patch.description         = updates.description;
  if (updates.recommendedProfile !== undefined) patch.recommended_profile = updates.recommendedProfile;
  if (updates.horizon            !== undefined) patch.horizon             = updates.horizon;
  if (updates.justification      !== undefined) patch.justification       = updates.justification;
  if (updates.status             !== undefined) patch.status              = updates.status;
  if (assets                     !== undefined) {
    const metrics = estimateMetrics(assets);
    patch.assets         = assets;
    patch.total_weight   = recalcTotalWeight(assets);
    patch.expected_return = metrics.expectedReturn || null;
    patch.expected_vol    = metrics.expectedVol    || null;
  }

  const { data, error } = await db.from('portfolios').update(patch).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToPortfolio(data) : null;
}

export async function deletePortfolio(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const idx = _memDB.findIndex(p => p.id === id);
    if (idx === -1) return false;
    _memDB.splice(idx, 1);
    return true;
  }

  const { error, count } = await db.from('portfolios').delete({ count: 'exact' }).eq('id', id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

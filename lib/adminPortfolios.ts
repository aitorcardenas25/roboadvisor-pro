// lib/adminPortfolios.ts

import type { InvestorProfile } from './products';

export type AssetType = 'fund' | 'etf' | 'stock';
export type PortfolioStatus = 'draft' | 'active' | 'archived';

export interface PortfolioAsset {
  type:          AssetType;
  id:            string;
  name:          string;
  isin?:         string;
  symbol?:       string;
  weight:        number;   // % 0–100
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

// Exemples inicials per a cada perfil
const SAMPLE_PORTFOLIOS: AdminPortfolio[] = [
  {
    id: 'port-conservador-model',
    name: 'Cartera Conservadora Model',
    description: 'Cartera de baix risc per a preservació de capital amb rendiment modest.',
    recommendedProfile: 'conservador',
    horizon: '3–5 anys',
    assets: [
      { type: 'fund', id: 'amundi-monetari-eur', name: 'Amundi Euro Liquidity SRI', isin: 'FR0010510008', weight: 20, justification: 'Component de liquiditat i baix risc' },
      { type: 'fund', id: 'pimco-rf-curta',      name: 'PIMCO Euro Short-Term',     isin: 'IE00B11XZ871', weight: 25, justification: 'Renda fixa curta durada, risc mínim' },
      { type: 'etf',  id: 'ishares-global-agg-bond-etf', name: 'iShares Global Agg Bond ETF', isin: 'IE00B3F81R35', weight: 30, justification: 'Diversificació RF global hedged EUR' },
      { type: 'fund', id: 'nordea-stable-return', name: 'Nordea Stable Return',     isin: 'LU0141799501', weight: 15, justification: 'Mixt defensiu amb baixa volatilitat' },
      { type: 'etf',  id: 'ishares-core-europe-etf', name: 'iShares Core Europe ETF', isin: 'IE00B4K48X80', weight: 10, justification: 'Component RV Europa mínima' },
    ],
    totalWeight: 100,
    expectedReturn: 3.2,
    expectedVol:    4.5,
    justification: 'Cartera orientada a preservació de capital amb exposició molt limitada a renda variable. Component principal en RF curta i monetaris per garantir liquiditat. Rendiment objectiu de 3–4% anual amb volatilitat <5%.',
    status: 'active',
    createdAt: '2026-04-01',
    updatedAt: '2026-04-28',
  },
  {
    id: 'port-moderat-model',
    name: 'Cartera Moderada Model',
    description: 'Equilibri entre creixement i estabilitat. Base indexada amb component actiu selectiu.',
    recommendedProfile: 'moderat',
    horizon: '5–10 anys',
    assets: [
      { type: 'etf',  id: 'ishares-msci-world-etf',     name: 'iShares MSCI World ETF',  isin: 'IE00B4L5Y983', weight: 35, justification: 'Core RV global indexat, màxima diversificació' },
      { type: 'etf',  id: 'ishares-global-agg-bond-etf',name: 'iShares Global Agg Bond',  isin: 'IE00B3F81R35', weight: 25, justification: 'Component defensiu RF global' },
      { type: 'fund', id: 'flossbach-multiple-opp',     name: 'Flossbach Multiple Opp.', isin: 'LU0323578657', weight: 20, justification: 'Mixt flexible de referència, gestió activa de qualitat' },
      { type: 'etf',  id: 'ishares-msci-em-etf',        name: 'iShares MSCI EM ETF',     isin: 'IE00BKM4GZ66', weight: 10, justification: 'Component emergents per diversificació global' },
      { type: 'fund', id: 'fidelity-dividend',          name: 'Fidelity Global Dividend', isin: 'LU0605515377', weight: 10, justification: 'Income i dividend per estabilitzar retorns' },
    ],
    totalWeight: 100,
    expectedReturn: 7.1,
    expectedVol:    9.8,
    justification: 'Cartera balancejada amb base indexada (60% RV/RF) i complement actiu selectiu. Orientada a inversors de 5–10 anys amb tolerància moderada. Objectiu de rendiment 6–8% anual amb volatilitat <12%.',
    status: 'active',
    createdAt: '2026-04-01',
    updatedAt: '2026-04-28',
  },
];

let portfoliosDB: AdminPortfolio[] = [...SAMPLE_PORTFOLIOS];

// ── Utilitats ─────────────────────────────────────────────────────────────────

export function recalcTotalWeight(assets: PortfolioAsset[]): number {
  return Math.round(assets.reduce((s, a) => s + a.weight, 0) * 100) / 100;
}

export function estimateMetrics(assets: PortfolioAsset[]): { expectedReturn: number; expectedVol: number } {
  try {
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

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function getAllPortfolios(): AdminPortfolio[] {
  return [...portfoliosDB].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getPortfolioById(id: string): AdminPortfolio | null {
  return portfoliosDB.find(p => p.id === id) ?? null;
}

export function getActivePortfolios(): AdminPortfolio[] {
  return portfoliosDB.filter(p => p.status === 'active');
}

export function createPortfolio(data: Omit<AdminPortfolio, 'id' | 'totalWeight' | 'expectedReturn' | 'expectedVol' | 'createdAt' | 'updatedAt'>): AdminPortfolio {
  const now      = new Date().toISOString().split('T')[0];
  const metrics  = estimateMetrics(data.assets);
  const portfolio: AdminPortfolio = {
    ...data,
    id:             `port-${Date.now()}`,
    totalWeight:    recalcTotalWeight(data.assets),
    expectedReturn: metrics.expectedReturn || null,
    expectedVol:    metrics.expectedVol    || null,
    createdAt:      now,
    updatedAt:      now,
  };
  portfoliosDB.push(portfolio);
  return portfolio;
}

export function updatePortfolio(id: string, updates: Partial<Omit<AdminPortfolio, 'id' | 'createdAt'>>): AdminPortfolio | null {
  const idx = portfoliosDB.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const assets  = updates.assets ?? portfoliosDB[idx].assets;
  const metrics = estimateMetrics(assets);
  portfoliosDB[idx] = {
    ...portfoliosDB[idx],
    ...updates,
    assets,
    totalWeight:    recalcTotalWeight(assets),
    expectedReturn: metrics.expectedReturn || portfoliosDB[idx].expectedReturn,
    expectedVol:    metrics.expectedVol    || portfoliosDB[idx].expectedVol,
    updatedAt:      new Date().toISOString().split('T')[0],
  };
  return portfoliosDB[idx];
}

export function deletePortfolio(id: string): boolean {
  const idx = portfoliosDB.findIndex(p => p.id === id);
  if (idx === -1) return false;
  portfoliosDB.splice(idx, 1);
  return true;
}

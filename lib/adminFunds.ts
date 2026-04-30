// lib/adminFunds.ts
// Base de dades de fons gestionable per l'admin

import { FINANCIAL_PRODUCTS } from './products';

export interface AdminFund {
  id:              string;
  name:            string;
  isin:            string;
  manager:         string;
  category:        string;
  assetClass:      string;
  region:          string;
  managementType:  'indexada' | 'passiva' | 'activa';
  benchmark:       string;
  risk:            1 | 2 | 3 | 4 | 5;
  profiles:        string[];
  ter:             number;
  currency:        string;
  expectedReturn:  number;
  expectedVol:     number;
  dataStatus:      'validated' | 'partial' | 'pending' | 'unavailable';
  justification:   string;
  active:          boolean;
  createdAt:       string;
  updatedAt:       string;
}

// Tots els fons del sistema, derivats de la base de productes financers
export const ADMIN_FUNDS_DB: AdminFund[] = FINANCIAL_PRODUCTS.map(p => ({
  id:             p.id,
  name:           p.name,
  isin:           p.isin,
  manager:        p.manager,
  category:       p.category,
  assetClass:     p.assetClass,
  region:         p.region,
  managementType: p.managementType,
  benchmark:      p.benchmark,
  risk:           p.risk as AdminFund['risk'],
  profiles:       p.recommendedProfiles,
  ter:            p.ter,
  currency:       p.currency,
  expectedReturn: p.historicalReturn5Y    ?? 5.0,
  expectedVol:    p.historicalVolatility  ?? 12.0,
  dataStatus:     p.dataStatus,
  justification:  p.justification,
  active:         true,
  createdAt:      '2024-01-01',
  updatedAt:      '2026-04-30',
}));

// Simulem persistència en memòria (en producció seria una BD real)
let fundsDatabase = [...ADMIN_FUNDS_DB];

export function getAllFunds(): AdminFund[] {
  return fundsDatabase;
}

export function getFundById(id: string): AdminFund | undefined {
  return fundsDatabase.find(f => f.id === id);
}

export function createFund(fund: Omit<AdminFund, 'id' | 'createdAt' | 'updatedAt'>): AdminFund {
  const newFund: AdminFund = {
    ...fund,
    id:        `fund-${Date.now()}`,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
  };
  fundsDatabase.push(newFund);
  return newFund;
}

export function updateFund(id: string, updates: Partial<AdminFund>): AdminFund | null {
  const index = fundsDatabase.findIndex(f => f.id === id);
  if (index === -1) return null;
  fundsDatabase[index] = {
    ...fundsDatabase[index],
    ...updates,
    updatedAt: new Date().toISOString().split('T')[0],
  };
  return fundsDatabase[index];
}

export function deleteFund(id: string): boolean {
  const index = fundsDatabase.findIndex(f => f.id === id);
  if (index === -1) return false;
  fundsDatabase.splice(index, 1);
  return true;
}

export function getFundStats() {
  const total   = fundsDatabase.length;
  const active  = fundsDatabase.filter(f => f.active).length;
  const byRisk  = [1,2,3,4,5].map(r => ({
    risk:  r,
    count: fundsDatabase.filter(f => f.risk === r).length,
  }));
  const avgTER  = fundsDatabase.reduce((s, f) => s + f.ter, 0) / total;

  return { total, active, byRisk, avgTER: Math.round(avgTER * 1000) / 1000 };
}
import { describe, it, expect } from 'vitest';
import { optimizeFromProfile } from '@/lib/portfolioAdapter';
import { buildPortfolio } from '@/lib/portfolio';
import type { InvestorProfile } from '@/lib/products';

const PROFILES: InvestorProfile[] = ['conservador', 'moderat', 'dinamic', 'agressiu'];

const BASE_Q = {
  clientName: 'Test',
  age: 35,
  annualIncome: 48000,
  monthlyExpenses: 2000,
  currentSavings: 30000,
  netWorth: 80000,
  totalDebt: 10000,
  financialGoal: 'creixement-moderat' as const,
  investmentHorizon: 15,
  targetAmount: 200000,
  initialInvestment: 20000,
  monthlyContribution: 500,
  percentageToInvest: 50,
  financialKnowledge: 'intermedi' as const,
  investmentExperience: '3-5-anys' as const,
  lossTolerance: 'fins-20' as const,
  reactionToDrops: 'no-fer-res' as const,
  worstAcceptableLoss: 20,
  esgPreference: 'no-importa' as const,
  liquidityNeed: 'potser-3-anys' as const,
  incomeStability: 'estable' as const,
  crisisExperience: 'vaig-aguantar' as const,
};

// ── optimizeFromProfile ───────────────────────────────────────────────────────

describe('optimizeFromProfile — no llença per a cap perfil', () => {
  for (const profile of PROFILES) {
    it(`perfil "${profile}" retorna un resultat vàlid`, () => {
      const result = optimizeFromProfile(profile);
      expect(['mpt-optimized', 'profile-model']).toContain(result.source);
      expect(isFinite(result.expectedReturn)).toBe(true);
      expect(isFinite(result.expectedVolatility)).toBe(true);
      expect(isFinite(result.expectedSharpe)).toBe(true);
    });
  }
});

describe('optimizeFromProfile — pesos', () => {
  it('pesos sumen a 1 (±0.01) per a tots els perfils', () => {
    for (const profile of PROFILES) {
      const result = optimizeFromProfile(profile);
      const sum = result.weights.reduce((s, w) => s + w, 0);
      expect(sum).toBeCloseTo(1, 1);
    }
  });

  it('tots els pesos ≥ 0 (long-only)', () => {
    for (const profile of PROFILES) {
      const result = optimizeFromProfile(profile);
      for (const w of result.weights) {
        expect(w).toBeGreaterThanOrEqual(-0.001); // tolerància numèrica
      }
    }
  });

  it('nombre de pesos = nombre d\'asset classes del perfil', () => {
    for (const profile of PROFILES) {
      const result = optimizeFromProfile(profile);
      expect(result.weights.length).toBe(result.assetIds.length);
    }
  });
});

describe('optimizeFromProfile — ordenació econòmica', () => {
  it('agressiu té rendiment esperat > conservador', () => {
    const cons = optimizeFromProfile('conservador');
    const agr  = optimizeFromProfile('agressiu');
    expect(agr.expectedReturn).toBeGreaterThan(cons.expectedReturn);
  });

  it('agressiu té volatilitat > conservador', () => {
    const cons = optimizeFromProfile('conservador');
    const agr  = optimizeFromProfile('agressiu');
    expect(agr.expectedVolatility).toBeGreaterThan(cons.expectedVolatility);
  });
});

// ── buildPortfolio integrat ───────────────────────────────────────────────────

describe('buildPortfolio — optimizationSource present', () => {
  it('sempre retorna un optimizationSource vàlid', () => {
    for (const profile of PROFILES) {
      const portfolio = buildPortfolio(profile, BASE_Q);
      expect(['mpt-optimized', 'profile-model']).toContain(portfolio.optimizationSource);
    }
  });

  it('si source=mpt-optimized, els números difereixen del model base hardcoded', () => {
    // Els valors MPT no han de ser exactament iguals als hardcoded
    const MODEL_RETURNS: Record<InvestorProfile, number> = {
      conservador: 2.5, moderat: 5.0, dinamic: 7.5, agressiu: 10.0,
    };
    for (const profile of PROFILES) {
      const portfolio = buildPortfolio(profile, BASE_Q);
      if (portfolio.optimizationSource === 'mpt-optimized') {
        expect(portfolio.expectedReturn).not.toBeCloseTo(MODEL_RETURNS[profile], 1);
      }
    }
  });

  it('buildPortfolio manté allocations intactes (noms, pesos hardcoded)', () => {
    const portfolio = buildPortfolio('moderat', { ...BASE_Q, monthlyContribution: 500 });
    // Medium tier moderat té 6 allocations
    expect(portfolio.allocations.length).toBeGreaterThanOrEqual(4);
    // Tots els pesos han de sumar ≈ 100
    const totalWeight = portfolio.allocations.reduce((s, a) => s + a.weight, 0);
    expect(totalWeight).toBe(100);
  });

  it('buildPortfolio funciona amb monthlyContribution=0 (tier simple)', () => {
    const portfolio = buildPortfolio('conservador', { ...BASE_Q, monthlyContribution: 0 });
    expect(portfolio.allocations.length).toBeGreaterThan(0);
    expect(['mpt-optimized', 'profile-model']).toContain(portfolio.optimizationSource);
  });
});

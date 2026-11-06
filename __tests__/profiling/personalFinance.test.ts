import { describe, it, expect } from 'vitest';
import { calculateScore } from '@/lib/scoring';
import type { InvestorQuestionnaire } from '@/lib/scoring';
import { analyzePersonalFinance } from '@/lib/personalFinance';

const base: InvestorQuestionnaire = {
  clientName: 'Test', age: 35, annualIncome: 48000, monthlyExpenses: 2000,
  currentSavings: 30000, netWorth: 80000, totalDebt: 10000,
  financialGoal: 'creixement-moderat', investmentHorizon: 15, targetAmount: 200000,
  initialInvestment: 20000, monthlyContribution: 500, percentageToInvest: 50,
  financialKnowledge: 'intermedi', investmentExperience: '3-5-anys', lossTolerance: 'fins-20',
  reactionToDrops: 'no-fer-res', worstAcceptableLoss: 20, esgPreference: 'no-importa',
  liquidityNeed: 'potser-3-anys', incomeStability: 'estable', crisisExperience: 'vaig-aguantar',
};
const run = (o: Partial<InvestorQuestionnaire> = {}) => {
  const q = { ...base, ...o };
  return analyzePersonalFinance(q, calculateScore(q));
};

describe('analyzePersonalFinance', () => {
  it('balanç: actiu = deute + patrimoni net', () => {
    const r = run()!;
    expect(r.balanceSheet.totalAssets).toBe(90000);
    expect(r.balanceSheet.totalLiabilities).toBe(10000);
    expect(r.balanceSheet.netWorthPct + r.balanceSheet.liabilitiesPct).toBeCloseTo(100, 6);
  });

  it('flux de caixa: taxa d\'estalvi = (ingressos - despeses) / ingressos', () => {
    const r = run()!;
    expect(r.cashFlow.annualExpenses).toBe(24000);
    expect(r.cashFlow.annualBalance).toBe(24000);
    expect(r.cashFlow.savingsRateSigned).toBe(50);
    expect(r.cashFlow.isDeficit).toBe(false);
  });

  it('detecta dèficit quan les despeses superen els ingressos', () => {
    const r = run({ annualIncome: 20000, monthlyExpenses: 2000 })!;
    expect(r.cashFlow.isDeficit).toBe(true);
    expect(r.cashFlow.savingsRateSigned).toBe(-20);
  });

  it('no inventa dades: sense ingressos retorna null', () => {
    expect(run({ annualIncome: 0 })).toBeNull();
  });

  it('retorna 5 ràtios i almenys un diagnòstic', () => {
    const r = run()!;
    expect(r.ratios).toHaveLength(5);
    expect(r.diagnosis.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import { calculateScore, validateQuestionnaire } from '@/lib/scoring';
import type { InvestorQuestionnaire } from '@/lib/scoring';

// ── Fixtures ───────────────────────────────────────────────────────────────

const base: InvestorQuestionnaire = {
  clientName:          'Test Client',
  age:                 35,
  annualIncome:        48000,
  monthlyExpenses:     2000,
  currentSavings:      30000,
  netWorth:            80000,
  totalDebt:           10000,
  financialGoal:       'creixement-moderat',
  investmentHorizon:   15,
  targetAmount:        200000,
  initialInvestment:   20000,
  monthlyContribution: 500,
  percentageToInvest:  50,
  financialKnowledge:  'intermedi',
  investmentExperience:'3-5-anys',
  lossTolerance:       'fins-20',
  reactionToDrops:     'no-fer-res',
  worstAcceptableLoss: 20,
  esgPreference:       'no-importa',
  liquidityNeed:       'potser-3-anys',
  incomeStability:     'estable',
  crisisExperience:    'vaig-aguantar',
};

function q(overrides: Partial<InvestorQuestionnaire>): InvestorQuestionnaire {
  return { ...base, ...overrides };
}

// ── Perfils ────────────────────────────────────────────────────────────────

describe('calculateScore — perfils', () => {
  it('perfil conservador: no accepta pèrdues → override obligatori', () => {
    const result = calculateScore(q({ lossTolerance: 'no-accepto-perdues' }));
    expect(result.profile).toBe('conservador');
  });

  it('perfil conservador: necessita liquiditat immediata → override', () => {
    const result = calculateScore(q({ liquidityNeed: 'necessito-ja' }));
    expect(result.profile).toBe('conservador');
  });

  it('perfil conservador: vendria tot en caiguda → override', () => {
    const result = calculateScore(q({ reactionToDrops: 'vendre-tot' }));
    expect(result.profile).toBe('conservador');
  });

  it('perfil conservador: pèrdua màxima ≤ 3% → override', () => {
    const result = calculateScore(q({ worstAcceptableLoss: 3, lossTolerance: 'fins-5' }));
    expect(result.profile).toBe('conservador');
  });

  it('perfil conservador: horitzó ≤ 2 anys → override', () => {
    const result = calculateScore(q({ investmentHorizon: 2 }));
    expect(result.profile).toBe('conservador');
  });

  it('perfil conservador: va vendre tot en crisi → override', () => {
    const result = calculateScore(q({ crisisExperience: 'vaig-vendre-tot' }));
    expect(result.profile).toBe('conservador');
  });

  it('perfil agressiu: inversor jove, horitzó llarg, alt coneixement', () => {
    const result = calculateScore(q({
      age:                  28,
      investmentHorizon:    30,
      financialKnowledge:   'expert',
      investmentExperience: 'mes-5-anys',
      lossTolerance:        'mes-30',
      reactionToDrops:      'comprar-agressivament',
      worstAcceptableLoss:  40,
      financialGoal:        'maxima-rendibilitat',
      liquidityNeed:        'no-necessito',
      crisisExperience:     'vaig-comprar-mes',
    }));
    expect(result.profile).toBe('agressiu');
  });

  it('perfil moderat: dades equilibrades sense extrems', () => {
    // base és moderat/dinàmic — afegim restriccions per assegurar moderat
    const result = calculateScore(q({
      age:                  50,
      investmentHorizon:    10,
      financialKnowledge:   'basic',
      investmentExperience: 'menys-1-any',
      lossTolerance:        'fins-10',
      reactionToDrops:      'vendre-part',
      worstAcceptableLoss:  10,
      liquidityNeed:        'potser-1-any',
      crisisExperience:     'vaig-vendre-part',
    }));
    expect(['conservador', 'moderat']).toContain(result.profile);
  });
});

// ── Estructura del resultat ────────────────────────────────────────────────

describe('calculateScore — estructura', () => {
  it('retorna totalScore dins del rang [0, maxScore]', () => {
    const result = calculateScore(base);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(result.maxScore);
    expect(result.maxScore).toBe(160);
  });

  it('scorePercentage és [0, 100]', () => {
    const result = calculateScore(base);
    expect(result.scorePercentage).toBeGreaterThanOrEqual(0);
    expect(result.scorePercentage).toBeLessThanOrEqual(100);
  });

  it('breakdown suma aproximadament totalScore', () => {
    const result = calculateScore(base);
    const sum = Object.values(result.breakdown).reduce((a, b) => a + b, 0);
    expect(sum).toBe(result.totalScore);
  });

  it('diagnostics.savingsRate és coherent', () => {
    const result = calculateScore(base);
    // savingsRate = (ingressos - despeses) / ingressos * 100
    const expected = ((base.annualIncome / 12 - base.monthlyExpenses) / (base.annualIncome / 12)) * 100;
    expect(result.diagnostics.savingsRate).toBeCloseTo(expected, 0);
  });

  it('diagnostics.emergencyFundMonths és coherent', () => {
    const result = calculateScore(base);
    const expected = base.currentSavings / base.monthlyExpenses;
    expect(result.diagnostics.emergencyFundMonths).toBeCloseTo(expected, 0);
  });
});

// ── Validació del qüestionari ──────────────────────────────────────────────

describe('validateQuestionnaire', () => {
  it('qüestionari vàlid passa sense errors', () => {
    const { isValid, errors } = validateQuestionnaire(base);
    expect(isValid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('edat fora de rang retorna error', () => {
    const { isValid, errors } = validateQuestionnaire(q({ age: 15 }));
    expect(isValid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('edat'))).toBe(true);
  });

  it('horitzó 0 retorna error', () => {
    const { isValid, errors } = validateQuestionnaire(q({ investmentHorizon: 0 }));
    expect(isValid).toBe(false);
    expect(errors.some(e => e.toLowerCase().includes('horitzó'))).toBe(true);
  });

  it('percentatge invertir fora de rang retorna error', () => {
    const { isValid, errors } = validateQuestionnaire(q({ percentageToInvest: 110 }));
    expect(isValid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('ingressos 0 retorna error', () => {
    const { isValid, errors } = validateQuestionnaire(q({ annualIncome: 0 }));
    expect(isValid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });
});

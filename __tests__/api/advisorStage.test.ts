import { describe, it, expect } from 'vitest';
import { advisorStage } from '@/lib/onboarding';

describe('advisorStage (pas de l\'alta a l\'admin)', () => {
  it('segueix l\'ordre dades → proposta → informe aprovat → cartera', () => {
    expect(advisorStage({ questionnaireData: null, proposals: [], holdings: 0 })).toBe('sense-dades');
    expect(advisorStage({ questionnaireData: { annualIncome: 30000 }, proposals: [], holdings: 0 })).toBe('dades');
    expect(advisorStage({ questionnaireData: null, proposals: ['draft'], holdings: 0 })).toBe('esborrany');
    expect(advisorStage({ questionnaireData: null, proposals: ['draft', 'approved'], holdings: 0 })).toBe('aprovat');
    expect(advisorStage({ questionnaireData: null, proposals: [], holdings: 3 })).toBe('actiu');
  });
});

import { onboardingStatus } from '@/lib/onboarding';

describe('portal bloquejat fins a l\'informe aprovat', () => {
  it('només s\'obre amb una proposta aprovada o una cartera', () => {
    expect(onboardingStatus({ questionnaireData: { monthlyNetIncome: 2000 }, latestProposal: null, holdings: 0 }).released).toBe(false);
    expect(onboardingStatus({ questionnaireData: null, latestProposal: 'draft', holdings: 0 }).released).toBe(false);
    expect(onboardingStatus({ questionnaireData: null, latestProposal: 'approved', holdings: 0 }).released).toBe(true);
    expect(onboardingStatus({ questionnaireData: null, latestProposal: null, holdings: 2 }).released).toBe(true);
  });
});

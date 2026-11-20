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

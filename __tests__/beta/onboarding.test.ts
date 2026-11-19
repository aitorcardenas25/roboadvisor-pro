import { describe, it, expect } from 'vitest';
import { onboardingStatus, hasClientData } from '@/lib/onboarding';

const states = (s: ReturnType<typeof onboardingStatus>) => s.steps.map(x => x.state);

describe('onboardingStatus (primers passos del client)', () => {
  it('client nou sense res: primer pas en curs, la resta pendents', () => {
    const s = onboardingStatus({ questionnaireData: null, latestProposal: null, holdings: 0 });
    expect(states(s)).toEqual(['en-curs', 'pendent', 'pendent']);
    expect(s.complete).toBe(false);
  });

  it('amb dades: l\'assessor prepara la proposta', () => {
    const s = onboardingStatus({ questionnaireData: { age: 24 }, latestProposal: null, holdings: 0 });
    expect(states(s)).toEqual(['fet', 'en-curs', 'pendent']);
  });

  it('proposta aprovada però sense cartera: el seguiment és el pas en curs', () => {
    const s = onboardingStatus({ questionnaireData: { goals: [{ horizon: 'curt', description: 'Fons d\'emergència' }] }, latestProposal: 'approved', holdings: 0 });
    expect(states(s)).toEqual(['fet', 'fet', 'en-curs']);
  });

  it('cartera activa: tot fet', () => {
    const s = onboardingStatus({ questionnaireData: {}, latestProposal: null, holdings: 3 });
    expect(states(s)).toEqual(['fet', 'fet', 'fet']);
    expect(s.complete).toBe(true);
  });

  it('camps buits o d\'altres pantalles no compten com a dades', () => {
    expect(hasClientData({ age: '', wealthItems: [], goals: [] })).toBe(false);
    expect(hasClientData({ monthlyNetIncome: 1400 })).toBe(true);
    expect(hasClientData({ selfKnowledge: 'basic' })).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { ADVISOR_FUNDS } from '@/lib/fundUniverse';
import { PROFILE_MODELS, PROPOSAL_TEMPLATES, templateItems } from '@/lib/proposalTemplates';

// Regressió: el TER desconegut es comptava com 0 % i inflava el rendiment net de les carteres tipus.
describe('TER de les carteres tipus', () => {
  it('cada fons de les carteres per perfil té TER oficial amb font', () => {
    const byIsin = new Map(ADVISOR_FUNDS.map(f => [f.isin, f]));
    for (const id of Object.values(PROFILE_MODELS)) {
      const t = PROPOSAL_TEMPLATES.find(h => h.id === id);
      expect(t, id).toBeDefined();
      for (const it of t!.weights) {
        const f = byIsin.get(it.isin);
        expect(f?.ter, it.isin).toBeGreaterThan(0);
        expect(f?.terSource, it.isin).toBeTruthy();
      }
    }
  });
});

describe('templateItems porta el TER oficial', () => {
  it('la cartera conservadora no té cap fons amb TER 0', () => {
    const items = templateItems(PROFILE_MODELS.conservador)!;
    expect(items.every(x => x.ter > 0)).toBe(true);
  });
});

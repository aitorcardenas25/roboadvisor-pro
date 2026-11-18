import { describe, it, expect } from 'vitest';
import { PROPOSAL_TEMPLATES, PROFILE_MODELS, templateItems } from '@/lib/proposalTemplates';
import { checkProposalSuitability, PROFILES } from '@/lib/proposalMath';
import { lookupIsin } from '@/lib/fundUniverse';

describe('plantilles de proposta', () => {
  it('cada plantilla suma 100 % i només fa servir fons coneguts de l\'assessor', () => {
    for (const t of PROPOSAL_TEMPLATES) {
      expect(t.weights.reduce((s, w) => s + w.weight, 0)).toBe(100);
      for (const w of t.weights) expect(lookupIsin(w.isin)).not.toBeNull();
      const items = templateItems(t.id)!;
      expect(items).toHaveLength(t.weights.length);
      expect(items.map(i => i.weight)).toEqual(t.weights.map(w => w.weight));
    }
  });
  it('no inventa rendiments: sense fitxa, les línies no porten dades de rendiment', () => {
    const items = templateItems('sessions-rv-diversificada')!;
    expect(items.find(i => i.isin === 'IE0008248803')?.historicalReturn5Y).toBeUndefined();
  });
  it('plantilla desconeguda → null', () => {
    expect(templateItems('no-existeix')).toBeNull();
  });

  it('cada perfil té una cartera tipus que passa el seu propi control d\'idoneïtat', () => {
    // Regressió (prova amb client fictici, 2026-11-18): la plantilla dinàmica superava el
    // SRRI màxim del perfil i "Suggerir segons perfil" triava fons sense preus.
    for (const profile of PROFILES) {
      const t = PROPOSAL_TEMPLATES.find(x => x.id === PROFILE_MODELS[profile])!;
      expect(t.profile).toBe(profile);
      const items = templateItems(t.id)!;
      const s = checkProposalSuitability({ items, profile, horizon: 10 });
      expect(s.issues.filter(i => i.level === 'inadequate')).toEqual([]);
    }
  });
  it('les plantilles fan servir només fons amb preus oficials carregats', () => {
    // ISIN sense valors liquidatius a fund_navs el 18/11/2026
    const senseDades = ['IE00BQQP9G91', 'IE00B03HCZ61'];
    for (const t of PROPOSAL_TEMPLATES) for (const w of t.weights) expect(senseDades).not.toContain(w.isin);
  });
});

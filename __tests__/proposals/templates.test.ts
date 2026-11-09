import { describe, it, expect } from 'vitest';
import { PROPOSAL_TEMPLATES, templateItems } from '@/lib/proposalTemplates';
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
});

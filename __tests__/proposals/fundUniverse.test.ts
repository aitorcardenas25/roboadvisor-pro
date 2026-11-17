import { describe, it, expect } from 'vitest';
import { ADVISOR_FUNDS, ALTERNATE_CLASSES, isValidIsin, lookupIsin } from '@/lib/fundUniverse';
import { fundOptions } from '@/lib/proposalMath';

describe('fundUniverse', () => {
  it('tots els ISIN són vàlids i no es repeteixen', () => {
    const all = [...ADVISOR_FUNDS, ...ALTERNATE_CLASSES].map(f => f.isin);
    expect(all.filter(i => !isValidIsin(i))).toEqual([]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('les classes duplicades no surten per triar però la importació les reconeix', () => {
    const options = new Set(fundOptions().map(f => f.isin));
    for (const f of ALTERNATE_CLASSES) {
      expect(options.has(f.isin)).toBe(false);
      expect(lookupIsin(f.isin)?.source).toBe('advisor');
    }
  });

  it('els fons amb històric oficial carregat es poden triar', () => {
    const options = new Set(fundOptions().map(f => f.isin));
    for (const isin of ['IE00B03HD191', 'IE00BF0GL436', 'LU0290358497', 'IE00BH65QP47']) {
      expect(options.has(isin)).toBe(true);
    }
  });
});

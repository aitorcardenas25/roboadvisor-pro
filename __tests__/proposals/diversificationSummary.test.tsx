// L'editor de propostes mostra la diversificació de la proposta i la de la cartera actual.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DiversificationSummary from '@/components/DiversificationSummary';

describe('Diversificació a l\'editor de propostes', () => {
  it('compara la proposta amb la cartera actual i marca els fons sense fitxa', () => {
    const html = renderToStaticMarkup(React.createElement(DiversificationSummary, {
      items: [
        { isin: 'IE00B03HD191', weight: 60, name: 'Vanguard Global Stock' },
        { isin: 'IE0031786696', weight: 20, name: 'Vanguard EM' },
        { isin: 'LU2305834041', weight: 20, name: 'Invesco Continental European Small Cap' },
      ],
      current: [{ isin: 'IE00B03HD191', weight: 100, name: 'Vanguard Global Stock' }],
    }));
    expect(html).toContain('Cartera actual');
    expect(html).toContain('EUA i Canadà');
    expect(html).toContain('Emergents');
    expect(html).toContain('Sense dades');
    expect(html).toContain('Sense fitxa carregada: Invesco Continental European Small Cap');
    expect(html).toContain('a 31/10/2026');
    expect(html).not.toMatch(/puntuaci|\d\s*\/\s*10\b(?!\/)/i);
  });

  it('una proposta només de renda fixa no mostra res', () => {
    const html = renderToStaticMarkup(React.createElement(DiversificationSummary, { items: [{ isin: 'IE00B18GC888', weight: 100 }] }));
    expect(html).toBe('');
  });
});

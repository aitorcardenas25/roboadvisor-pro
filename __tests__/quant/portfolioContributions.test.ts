import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ getDb: () => null }));

import { computeMetrics, type ClientPortfolio } from '@/lib/clientPortfolios';

// Regressió (prova amb client fictici, 2026-11-18): Excel amb "Aportació 7.500"
// + "Compra 7.500" del mateix fons sortia com a 15.000 aportats i -50 %.
const base = (transactions: Partial<ClientPortfolio['transactions'][number]>[]): ClientPortfolio => ({
  id: 'p', clientId: 'c', clientName: 'Prova', name: 'Prova', description: '', recommendations: '',
  holdings: [{ id: 'h', portfolioId: 'p', assetIsin: 'IE00B03HD191', assetName: 'Vanguard', assetCategory: 'RV', broker: 'B',
    quantity: 150, avgEntryPrice: 50, currentPrice: 50, priceLastUpdated: '2026-11-18', priceSource: 'pending', currency: 'EUR' }],
  transactions: transactions.map((t, i) => ({ id: `t${i}`, portfolioId: 'p', quantity: 0, priceEur: 0, commission: 0, ...t })),
  createdAt: '', updatedAt: '',
} as unknown as ClientPortfolio);

describe('computeMetrics — aportacions netes', () => {
  it('aportació + compra amb aquells diners compta una sola vegada', () => {
    const m = computeMetrics(base([
      { operationType: 'deposit', date: '2025-01-15', totalEur: 7500 },
      { operationType: 'buy',     date: '2025-01-16', totalEur: 7500, quantity: 150, priceEur: 50 },
    ]));
    expect(m.totalInvested).toBe(7500);
    expect(m.pnlEur).toBe(0);
  });

  it('el mateix dia, l\'ordre de les files no importa', () => {
    const m = computeMetrics(base([
      { operationType: 'buy',     date: '2025-01-15', totalEur: 7500 },
      { operationType: 'deposit', date: '2025-01-15', totalEur: 7500 },
    ]));
    expect(m.totalInvested).toBe(7500);
  });

  it('només compres (sense aportacions): el cost de les compres és l\'aportació', () => {
    const m = computeMetrics(base([{ operationType: 'buy', date: '2025-01-16', totalEur: 7000, commission: 10 }]));
    expect(m.totalInvested).toBe(7010);
  });

  it('compra més gran que l\'aportació: la diferència és aportació nova', () => {
    const m = computeMetrics(base([
      { operationType: 'deposit', date: '2025-01-15', totalEur: 5000 },
      { operationType: 'buy',     date: '2025-01-16', totalEur: 7500 },
    ]));
    expect(m.totalInvested).toBe(7500);
  });

  it('reestructuració (venda + compres + aportació nova) mostra el guany real', () => {
    // Cas de producció: 150 part. comprades a 50 €, venudes a 64,30 € (9.645 €)
    // i reinvertides amb 2.500 € nous (12.145 €). Guany real: 2.145 €.
    const p = base([
      { operationType: 'deposit', date: '2025-01-15', totalEur: 7500 },
      { operationType: 'buy',     date: '2025-01-16', totalEur: 7500 },
      { operationType: 'sell',    date: '2026-11-18', totalEur: 9645 },
      { operationType: 'buy',     date: '2026-11-18', totalEur: 12145 },
    ]);
    p.holdings = [{ ...p.holdings[0], quantity: 1, avgEntryPrice: 12145, currentPrice: 12145 }];
    const m = computeMetrics(p);
    expect(m.totalInvested).toBe(10000);
    expect(m.pnlEur).toBe(2145);
  });
});

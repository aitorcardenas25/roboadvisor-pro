import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ getDb: () => null }));

import { computeDrift, reviewStatus } from '@/lib/portfolioAlerts';
import { saveDraft, approveProposal, type ProposalItem } from '@/lib/proposals';
import { createClientPortfolio, addHolding } from '@/lib/clientPortfolios';
import { getPortfolioAlerts } from '@/lib/portfolioAlertsServer';

const h = (assetIsin: string, quantity: number, currentPrice: number) => ({ assetIsin, assetName: assetIsin, quantity, currentPrice });

describe('computeDrift', () => {
  it('compara el pes actual (valor de mercat) amb el pes objectiu', () => {
    const d = computeDrift([h('A', 70, 10), h('B', 30, 10)], [{ isin: 'A', name: 'A', weight: 60 }, { isin: 'B', name: 'B', weight: 40 }]);
    expect(d.totalValue).toBe(1000);
    expect(d.rows.map(r => [r.isin, r.target, r.current, r.diff])).toEqual([['A', 60, 70, 10], ['B', 40, 30, -10]]);
    expect(d.maxAbsDiff).toBe(10);
    expect(d.outOfBand).toHaveLength(2);
  });

  it('fons fora de la proposta o que falten també compten; dins del llindar no avisa', () => {
    const d = computeDrift([h('A', 58, 10), h('X', 2, 10)], [{ isin: 'A', name: 'A', weight: 60 }, { isin: 'B', name: 'B', weight: 40 }]);
    expect(d.rows.find(r => r.isin === 'B')).toMatchObject({ target: 40, current: 0, diff: -40 });
    expect(d.rows.find(r => r.isin === 'X')).toMatchObject({ target: 0, current: 3.33 });
    const ok = computeDrift([h('A', 62, 10), h('B', 38, 10)], [{ isin: 'A', name: 'A', weight: 60 }, { isin: 'B', name: 'B', weight: 40 }]);
    expect(ok.outOfBand).toEqual([]);
  });
});

describe('reviewStatus', () => {
  it('seguiment vençut i revisió anual', () => {
    expect(reviewStatus({ nextFollowup: '2026-11-01', lastApprovedAt: '2026-06-01' }, '2026-11-17')).toMatchObject({ due: true, reasons: ['followup_due'] });
    expect(reviewStatus({ nextFollowup: '2027-01-01', lastApprovedAt: '2025-10-01' }, '2026-11-17')).toMatchObject({ due: true, reasons: ['annual_review'] });
    expect(reviewStatus({ nextFollowup: '2027-01-01', lastApprovedAt: '2026-06-01' }, '2026-11-17')).toMatchObject({ due: false, reasons: [] });
    expect(reviewStatus({}, '2026-11-17')).toMatchObject({ due: false, reasons: ['no_followup'] });
  });
});

describe('getPortfolioAlerts (memòria)', () => {
  it('fa servir com a objectiu l\'última proposta aprovada', async () => {
    const item = (isin: string, weight: number): ProposalItem => ({ isin, name: isin, category: '', weight, risk: 4, ter: 0.2, platform: '', justification: '', historicalReturn5Y: 6, historicalVolatility: 10, performanceSource: 't' });
    const d = await saveDraft('al-1', { profile: 'moderat', objective: '', horizon: 10, initialAmount: 1000, monthlyAmount: 0, adminNote: '', items: [item('IE00B03HD191', 50), item('ES0114673033', 50)] });
    expect((await approveProposal('al-1', d.id, 'x')).ok).toBe(true);
    const p = await createClientPortfolio({ clientId: 'al-1', clientName: 'Al', name: 'C', description: '', recommendations: '' });
    const base = { assetCategory: '', broker: '', avgEntryPrice: 1, priceLastUpdated: '2026-11-01', currency: 'EUR' };
    await addHolding(p.id, { ...base, assetIsin: 'IE00B03HD191', assetName: 'G', quantity: 700, currentPrice: 1 });
    await addHolding(p.id, { ...base, assetIsin: 'ES0114673033', assetName: 'B', quantity: 300, currentPrice: 1 });
    const [a] = await getPortfolioAlerts('al-1');
    expect(a.targetVersion).toBe(1);
    expect(a.drift?.outOfBand.map(r => r.diff)).toEqual([20, -20]);
  });
});

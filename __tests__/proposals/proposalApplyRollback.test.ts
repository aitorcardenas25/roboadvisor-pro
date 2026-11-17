import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ getDb: () => null }));
// La segona compra falla: s'ha de desfer tot.
vi.mock('@/lib/clientPortfolios', async (orig) => {
  const real = await orig<typeof import('@/lib/clientPortfolios')>();
  let n = 0;
  return { ...real, addTransaction: async (...a: Parameters<typeof real.addTransaction>) => { if (++n === 2) throw new Error('BD caiguda'); return real.addTransaction(...a); } };
});

import { saveDraft, approveProposal, getProposals, type ProposalItem } from '@/lib/proposals';
import { applyProposal } from '@/lib/proposalApply';
import { upsertNavs } from '@/lib/fundNavs';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';

const item = (isin: string, weight: number): ProposalItem => ({
  isin, name: isin, category: 'RV', weight, risk: 4, ter: 0.2, platform: '', justification: '',
  historicalReturn5Y: 7, historicalVolatility: 14, performanceSource: 'test',
});

describe('applyProposal: error a mig camí', () => {
  it('desfà les posicions, la cartera i la marca de la versió', async () => {
    await upsertNavs([
      { isin: 'IE00B03HD191', date: '2026-09-30', nav: 42, currency: 'EUR' },
      { isin: 'ES0114673033', date: '2026-09-30', nav: 95, currency: 'EUR' },
    ]);
    const d = await saveDraft('rb-1', { profile: 'moderat', objective: '', horizon: 10, initialAmount: 1000, monthlyAmount: 0, adminNote: '', items: [item('IE00B03HD191', 50), item('ES0114673033', 50)] });
    const r = await approveProposal('rb-1', d.id, 'x');
    expect(r.ok).toBe(true);

    const res = await applyProposal({ clientId: 'rb-1', clientName: 'Rb', proposalId: d.id, date: '2026-09-30', amount: 1000, broker: '', by: 'x' });
    expect(res).toMatchObject({ ok: false, status: 500, error: expect.stringMatching(/No s'ha desat res/) });
    expect(await getPortfolioByClientId('rb-1')).toBeNull();
    expect((await getProposals('rb-1'))[0].appliedAt).toBeUndefined();
  });
});

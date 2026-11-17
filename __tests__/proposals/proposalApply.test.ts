import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ getDb: () => null }));

import { saveDraft, approveProposal, getProposals, __resetProposalsForTests, type ProposalItem, type ProposalParams } from '@/lib/proposals';
import { applyProposal } from '@/lib/proposalApply';
import { upsertNavs, __resetNavsForTests } from '@/lib/fundNavs';
import { getPortfolioByClientId, computeMetrics } from '@/lib/clientPortfolios';
import { valuationSeries } from '@/lib/portfolioValuation';

const A = 'IE00B03HD191', B = 'ES0114673033';
const item = (isin: string, weight: number): ProposalItem => ({
  isin, name: isin === A ? 'Vanguard Global Stock' : 'Bestinfond', category: 'RV Global', weight, risk: 4, ter: 0.2,
  platform: '', justification: '', historicalReturn5Y: 7, historicalVolatility: 14, performanceSource: 'test',
});
const params: ProposalParams = { profile: 'moderat', objective: 'Creixement', horizon: 10, initialAmount: 10000, monthlyAmount: 0, adminNote: '' };

async function approved(clientId: string) {
  const d = await saveDraft(clientId, { ...params, items: [item(A, 60), item(B, 40)] });
  const r = await approveProposal(clientId, d.id, 'admin@x');
  if (!r.ok) throw new Error(r.error);
  return r.proposal;
}

describe('applyProposal (memòria)', () => {
  beforeEach(async () => {
    __resetProposalsForTests(); __resetNavsForTests();
    await upsertNavs([
      { isin: A, date: '2026-09-30', nav: 42, currency: 'EUR' }, { isin: A, date: '2026-10-30', nav: 44, currency: 'EUR' },
      { isin: B, date: '2026-09-30', nav: 95, currency: 'EUR' }, { isin: B, date: '2026-10-30', nav: 110, currency: 'EUR' },
    ]);
  });

  it('crea la cartera amb les posicions i les compres, i marca la versió', async () => {
    const p = await approved('apply-1');
    const r = await applyProposal({ clientId: 'apply-1', clientName: 'Anna', proposalId: p.id, date: '2026-09-30', amount: 10000, broker: 'MyInvestor', by: 'admin@x' });
    expect(r.ok).toBe(true);

    const port = await getPortfolioByClientId('apply-1');
    expect(port?.holdings.map(h => [h.assetIsin, h.quantity, h.avgEntryPrice, h.currentPrice, h.priceSource])).toEqual([
      [A, 142.857143, 42, 44, 'manual'],
      [B, 42.105263, 95, 110, 'manual'],
    ]);
    expect(port?.transactions.map(t => [t.operationType, t.totalEur, t.date])).toEqual([['buy', 6000, '2026-09-30'], ['buy', 4000, '2026-09-30']]);
    expect(computeMetrics(port!).totalInvested).toBe(10000);
    expect((await getProposals('apply-1'))[0].appliedPortfolioId).toBe(port!.id);

    // L'evolució surt dels mateixos preus oficials
    const v = valuationSeries(port!.holdings, port!.transactions, [
      { isin: A, date: '2026-09-30', nav: 42, currency: 'EUR' }, { isin: A, date: '2026-10-30', nav: 44, currency: 'EUR' },
      { isin: B, date: '2026-09-30', nav: 95, currency: 'EUR' }, { isin: B, date: '2026-10-30', nav: 110, currency: 'EUR' },
    ], '2026-11-17');
    expect(v.points.map(x => x.value)).toEqual([10000, 10917.29]);
  });

  it('no es pot aplicar dues vegades ni sobre una cartera amb posicions', async () => {
    const p = await approved('apply-2');
    const args = { clientId: 'apply-2', clientName: 'Pau', proposalId: p.id, date: '2026-09-30', amount: 5000, broker: '', by: 'x' };
    expect((await applyProposal(args)).ok).toBe(true);
    const again = await applyProposal(args);
    expect(again).toMatchObject({ ok: false, status: 409 });

    const p2 = await approved('apply-2');
    expect(await applyProposal({ ...args, proposalId: p2.id })).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/ja té posicions/) });
  });

  it('sense preus oficials no crea res', async () => {
    const p = await approved('apply-3');
    const r = await applyProposal({ clientId: 'apply-3', clientName: 'Laia', proposalId: p.id, date: '2026-08-15', amount: 1000, broker: '', by: 'x' });
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(r.ok ? [] : r.problems).toHaveLength(2);
    expect(await getPortfolioByClientId('apply-3')).toBeNull();
    expect((await getProposals('apply-3'))[0].appliedAt).toBeUndefined();
  });

  it('un esborrany no es pot passar a la cartera', async () => {
    const d = await saveDraft('apply-4', { ...params, items: [item(A, 100)] });
    expect(await applyProposal({ clientId: 'apply-4', clientName: 'X', proposalId: d.id, date: '2026-09-30', amount: 1000, broker: '', by: 'x' }))
      .toMatchObject({ ok: false, status: 422 });
  });
});

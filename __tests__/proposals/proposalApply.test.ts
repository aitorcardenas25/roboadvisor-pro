import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ getDb: () => null }));

import { saveDraft, approveProposal, getProposals, __resetProposalsForTests, type ProposalItem, type ProposalParams } from '@/lib/proposals';
import { applyProposal } from '@/lib/proposalApply';
import { upsertNavs, __resetNavsForTests } from '@/lib/fundNavs';
import { getPortfolioByClientId, computeMetrics, updateHolding } from '@/lib/clientPortfolios';
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

  it('no es pot aplicar dues vegades la mateixa versió', async () => {
    const p = await approved('apply-2');
    const args = { clientId: 'apply-2', clientName: 'Pau', proposalId: p.id, date: '2026-09-30', amount: 5000, broker: '', by: 'x' };
    expect((await applyProposal(args)).ok).toBe(true);
    expect(await applyProposal(args)).toMatchObject({ ok: false, status: 409 });
  });

  it('dryRun només calcula: no crea res ni marca la versió', async () => {
    const p = await approved('apply-5');
    const r = await applyProposal({ clientId: 'apply-5', clientName: 'Joan', proposalId: p.id, date: '2026-09-30', amount: 10000, broker: '', by: 'x', dryRun: true });
    expect(r).toMatchObject({ ok: true, mode: 'first', dryRun: true, newValue: 10000 });
    expect(await getPortfolioByClientId('apply-5')).toBeNull();
    expect((await getProposals('apply-5'))[0].appliedAt).toBeUndefined();
  });

  it('reestructura una cartera amb posicions als pesos de la versió nova', async () => {
    const p1 = await approved('apply-6');
    const base = { clientId: 'apply-6', clientName: 'Marta', broker: 'MyInvestor', by: 'x' };
    expect((await applyProposal({ ...base, proposalId: p1.id, date: '2026-09-30', amount: 10000 })).ok).toBe(true);

    // v2: 100 % A. El 30/10 la cartera val 142,857143×44 + 42,105263×110 = 10.917,29 €; +1.000 € d'aportació
    const d = await saveDraft('apply-6', { ...params, items: [item(A, 100)] });
    const a2 = await approveProposal('apply-6', d.id, 'x');
    if (!a2.ok) throw new Error(a2.error);
    const preview = await applyProposal({ ...base, proposalId: d.id, date: '2026-10-30', amount: 1000, dryRun: true });
    expect(preview).toMatchObject({ ok: true, mode: 'rebalance', currentValue: 10917.29, newValue: 11917.29 });
    expect(preview.ok && preview.lines.map(l => [l.side, l.isin, l.quantity, l.amount])).toEqual([
      ['sell', B, 42.105263, 4631.58],
      ['buy', A, 127.990357, 5631.58],
    ]);

    const r = await applyProposal({ ...base, proposalId: d.id, date: '2026-10-30', amount: 1000 });
    expect(r.ok).toBe(true);
    const port = (await getPortfolioByClientId('apply-6'))!;
    const hA = port.holdings.find(h => h.assetIsin === A)!, hB = port.holdings.find(h => h.assetIsin === B)!;
    expect([hA.quantity, hB.quantity]).toEqual([270.8475, 0]);
    expect(hA.avgEntryPrice).toBeCloseTo((6000 + 5631.58) / 270.8475, 6);   // preu mitjà de les dues compres
    expect(port.transactions.map(t => [t.operationType, t.totalEur])).toEqual([['buy', 6000], ['buy', 4000], ['sell', 4631.58], ['buy', 5631.58]]);
    expect(computeMetrics(port).totalInvested).toBe(11000);   // 10.000 + 1.000 d'aportació nova
    expect((await getProposals('apply-6'))[0]).toMatchObject({ version: 2, appliedPortfolioId: port.id });

    // L'evolució continua quadrant: posició venuda inclosa fins a la venda
    const v = valuationSeries(port.holdings, port.transactions, [
      { isin: A, date: '2026-09-30', nav: 42, currency: 'EUR' }, { isin: A, date: '2026-10-30', nav: 44, currency: 'EUR' },
      { isin: B, date: '2026-09-30', nav: 95, currency: 'EUR' }, { isin: B, date: '2026-10-30', nav: 110, currency: 'EUR' },
    ], '2026-11-17');
    expect(v.points.at(-1)).toMatchObject({ date: '2026-10-30', value: 11917.29 });
  });

  it('no reestructura si les operacions no quadren amb les participacions', async () => {
    const p1 = await approved('apply-7');
    expect((await applyProposal({ clientId: 'apply-7', clientName: 'Q', proposalId: p1.id, date: '2026-09-30', amount: 1000, broker: '', by: 'x' })).ok).toBe(true);
    const port = (await getPortfolioByClientId('apply-7'))!;
    await updateHolding(port.holdings[0].id, port.id, { quantity: 999 });
    const p2 = await approved('apply-7');
    const r = await applyProposal({ clientId: 'apply-7', clientName: 'Q', proposalId: p2.id, date: '2026-10-30', amount: 0, broker: '', by: 'x' });
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(r.ok ? [] : r.problems).toEqual([expect.stringMatching(/sumen/)]);
    expect((await getProposals('apply-7'))[0].appliedAt).toBeUndefined();
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

// Regressió dels errors trobats a la segona prova sencera (19/11/2026):
//  1) L'informe mensual d'un mes passat ensenyava les posicions i el valor d'avui
//     i les comparava amb una proposta aprovada després del període.
//  2) Les posicions venudes del tot sortien com a "pendents de compra".
//  3) Després d'importar l'Excel, la cartera es valorava a preu de cost encara que
//     el fons ja tingués valors liquidatius oficials.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ getDb: () => null }));

import { saveDraft, approveProposal, __resetProposalsForTests, type ProposalItem, type ProposalParams } from '@/lib/proposals';
import { applyProposal } from '@/lib/proposalApply';
import { upsertNavs, getNavs, latestNavs, __resetNavsForTests } from '@/lib/fundNavs';
import {
  getPortfolioByClientId, getPortfolioById, createClientPortfolio, addHolding, syncHoldingsToNavs, isSoldOut,
} from '@/lib/clientPortfolios';
import { buildOfficialSection, generateMonthlyReportData, withPeriodEndFigures } from '@/lib/portfolioReport';
import { targetProposal } from '@/lib/portfolioAlertsServer';
import { pickTargetAt, effectiveApplyDate } from '@/lib/portfolioAlerts';
import { holdingAt } from '@/lib/portfolioValuation';

const A = 'IE00B03HD191', B = 'ES0114673033';
const item = (isin: string, weight: number): ProposalItem => ({
  isin, name: isin === A ? 'Vanguard Global Stock' : 'Bestinfond', category: 'RV Global', weight, risk: 4, ter: 0.2,
  platform: '', justification: '', historicalReturn5Y: 7, historicalVolatility: 14, performanceSource: 'test',
});
const params: ProposalParams = { profile: 'moderat', objective: 'Creixement', horizon: 10, initialAmount: 10000, monthlyAmount: 0, adminNote: '' };

async function approve(clientId: string, items: ProposalItem[]) {
  const d = await saveDraft(clientId, { ...params, items });
  const r = await approveProposal(clientId, d.id, 'admin@x');
  if (!r.ok) throw new Error(r.error);
  return r.proposal;
}

beforeEach(async () => {
  __resetProposalsForTests(); __resetNavsForTests();
  await upsertNavs([
    { isin: A, date: '2026-08-31', nav: 40, currency: 'EUR' }, { isin: A, date: '2026-09-30', nav: 42, currency: 'EUR' }, { isin: A, date: '2026-10-30', nav: 44, currency: 'EUR' },
    { isin: B, date: '2026-08-31', nav: 90, currency: 'EUR' }, { isin: B, date: '2026-09-30', nav: 95, currency: 'EUR' }, { isin: B, date: '2026-10-30', nav: 110, currency: 'EUR' },
  ]);
});

describe('proposta objectiu a una data', () => {
  const txs = [
    { date: '2026-09-30', notes: 'Proposta v1' },
    { date: '2026-10-30', notes: '[traspàs] Reestructuració a la proposta v2' },
    { date: '2026-10-30', notes: 'Reestructuració a la proposta v2' },
  ];
  const props = [
    { version: 2, status: 'approved', approvedAt: '2026-11-19T10:00:00Z', appliedAt: '2026-11-19T10:05:00Z', appliedPortfolioId: 'p1' },
    { version: 1, status: 'approved', approvedAt: '2026-11-19T09:00:00Z', appliedAt: '2026-11-19T09:05:00Z', appliedPortfolioId: 'p1' },
  ];

  it('la data efectiva és la de les operacions, no el dia que es va prémer el botó', () => {
    expect(effectiveApplyDate(2, txs, '2026-11-19T10:05:00Z')).toBe('2026-10-30');
    expect(effectiveApplyDate(3, txs, '2026-11-19T10:05:00Z')).toBe('2026-11-19');
  });

  it('tria la versió vigent a cada data i cap abans de la primera', () => {
    expect(pickTargetAt(props, 'p1', txs, '2026-08-31')).toBeNull();
    expect(pickTargetAt(props, 'p1', txs, '2026-09-30')?.version).toBe(1);
    expect(pickTargetAt(props, 'p1', txs, '2026-10-31')?.version).toBe(2);
  });

  it('cartera importada i proposta aprovada i passada després del període: sense objectiu', () => {
    // Cas de la prova: posicions de l'Excel, v1 aprovada i reestructurada el 19/11, informe d'octubre
    const p = [{ version: 1, status: 'approved', approvedAt: '2026-11-19T16:00:00Z', appliedAt: '2026-11-19T16:04:00Z', appliedPortfolioId: 'p9' }];
    const t = [{ date: '2025-01-31', notes: 'FICTICI' }, { date: '2026-11-19', notes: 'Reestructuració a la proposta v1' }];
    expect(pickTargetAt(p, 'p9', t, '2026-10-31')).toBeNull();
    expect(pickTargetAt(p, 'p9', t, '2026-11-30')?.version).toBe(1);
  });
});

describe('informe mensual d\'un període passat', () => {
  it('setembre, abans d\'una reestructuració d\'octubre: capçalera, posicions i objectiu de setembre', async () => {
    const v1 = await approve('fx-1', [item(A, 60), item(B, 40)]);
    await applyProposal({ clientId: 'fx-1', clientName: 'Pau', proposalId: v1.id, date: '2026-09-30', amount: 10000, broker: '', by: 'x' });
    const v2 = await approve('fx-1', [item(A, 100)]);
    await applyProposal({ clientId: 'fx-1', clientName: 'Pau', proposalId: v2.id, date: '2026-10-30', amount: 0, broker: '', by: 'x' });
    const port = (await getPortfolioByClientId('fx-1'))!;
    const navs = [...await getNavs(A), ...await getNavs(B)];

    const { target, lastApprovedAt } = await targetProposal(port, '2026-09-30');
    expect(target?.version).toBe(1);   // no la v2, que encara no s'havia passat a la cartera

    let r = generateMonthlyReportData(port, '', '2026-09-01', '2026-09-30');
    // Sense corregir, la capçalera i les posicions són les d'avui: tot al fons A
    expect(r.topHoldings.map(h => h.name)).toEqual(['Vanguard Global Stock']);
    r.official = buildOfficialSection(port, navs, target, lastApprovedAt, '2026-09-01', '2026-09-30');
    r = withPeriodEndFigures(r);

    expect(r.asOf).toBe('2026-09-30');
    expect(r.metrics).toMatchObject({ currentValue: 10000, netContributions: 10000, pnlEur: 0, pnlPct: 0 });
    expect(r.topHoldings.map(h => [h.name, h.value, h.weight, h.pnlPct])).toEqual([
      ['Vanguard Global Stock', 6000, 60, 0],
      ['Bestinfond', 4000, 40, 0],
    ]);
    expect(r.official!.allocation).toMatchObject({ targetVersion: 1 });
    expect(r.official!.allocation!.rows.every(x => x.diff === 0)).toBe(true);
  });

  it('octubre: posicions al VL del final del període, amb el guany sobre el cost', async () => {
    const v1 = await approve('fx-2', [item(A, 60), item(B, 40)]);
    await applyProposal({ clientId: 'fx-2', clientName: 'Anna', proposalId: v1.id, date: '2026-09-30', amount: 10000, broker: '', by: 'x' });
    const port = (await getPortfolioByClientId('fx-2'))!;
    const navs = [...await getNavs(A), ...await getNavs(B)];
    const { target, lastApprovedAt } = await targetProposal(port, '2026-10-31');
    const r = withPeriodEndFigures({
      ...generateMonthlyReportData(port, '', '2026-10-01', '2026-10-31'),
      official: buildOfficialSection(port, navs, target, lastApprovedAt, '2026-10-01', '2026-10-31'),
    });
    // A: 142,857143 × 44 = 6.285,71 (+4,76 %) · B: 42,105263 × 110 = 4.631,58 (+15,79 %)
    expect(r.topHoldings.map(h => [h.name, h.value, h.pnlPct])).toEqual([
      ['Vanguard Global Stock', 6285.71, 4.76],
      ['Bestinfond', 4631.58, 15.79],
    ]);
    expect(r.metrics.currentValue).toBe(r.official!.performance!.valueEnd);
    expect(r.metrics.pnlEur).toBeCloseTo(917.29, 2);
  });

  it('sense resultat oficial (falten preus) l\'informe es queda com estava', async () => {
    const v1 = await approve('fx-3', [item(A, 60), item(B, 40)]);
    await applyProposal({ clientId: 'fx-3', clientName: 'Laia', proposalId: v1.id, date: '2026-09-30', amount: 10000, broker: '', by: 'x' });
    const port = (await getPortfolioByClientId('fx-3'))!;
    const base = generateMonthlyReportData(port, '', '2027-01-01', '2027-01-31');
    base.official = buildOfficialSection(port, [...await getNavs(A), ...await getNavs(B)], null, undefined, '2027-01-01', '2027-01-31');
    const r = withPeriodEndFigures(base);
    expect(r.asOf).toBeUndefined();
    expect(r.metrics).toEqual(base.metrics);
  });
});

describe('posicions venudes del tot', () => {
  it('no són propostes pendents de compra', async () => {
    const v1 = await approve('fx-4', [item(A, 60), item(B, 40)]);
    await applyProposal({ clientId: 'fx-4', clientName: 'Marc', proposalId: v1.id, date: '2026-09-30', amount: 10000, broker: '', by: 'x' });
    const v2 = await approve('fx-4', [item(A, 100)]);
    await applyProposal({ clientId: 'fx-4', clientName: 'Marc', proposalId: v2.id, date: '2026-10-30', amount: 0, broker: '', by: 'x' });
    const port = (await getPortfolioByClientId('fx-4'))!;
    const sold = port.holdings.find(h => h.assetIsin === B)!;
    expect(sold.quantity).toBe(0);
    expect(isSoldOut(sold, port.transactions)).toBe(true);
    expect(isSoldOut(port.holdings.find(h => h.assetIsin === A)!, port.transactions)).toBe(false);
    // 0 participacions i cap venda: sí que és una proposta pendent
    expect(isSoldOut({ id: 'x', quantity: 0 }, port.transactions)).toBe(false);
  });
});

describe('importació d\'Excel', () => {
  it('les posicions amb preu provisional passen a l\'últim VL oficial', async () => {
    const p = await createClientPortfolio({ clientId: 'fx-5', clientName: 'Gemma', name: 'Cartera', description: '', recommendations: '' });
    await addHolding(p.id, {
      assetIsin: B, assetName: 'Bestinfond', assetCategory: 'RV', broker: 'X', quantity: 5, avgEntryPrice: 80,
      currentPrice: 80, priceLastUpdated: '2026-11-19T15:58:58.475Z', priceSource: 'pending', currency: 'EUR',
    });
    const latest = await latestNavs([B, 'XX0000000000']);
    expect(latest.map(l => [l.isin, l.date, l.nav])).toEqual([[B, '2026-10-30', 110]]);
    expect(await syncHoldingsToNavs(latest)).toBeGreaterThanOrEqual(1);
    const h = (await getPortfolioById(p.id))!.holdings[0];
    expect(h).toMatchObject({ currentPrice: 110, priceLastUpdated: '2026-10-30', priceSource: 'manual' });
  });
});

describe('participacions i cost a una data (posicions de l\'informe)', () => {
  const h = { id: 'h1', assetIsin: A, assetName: 'A', quantity: 10, avgEntryPrice: 20, currentPrice: 30, createdAt: '2026-01-01T00:00:00Z' };
  const tx = (date: string, op: 'buy' | 'sell', quantity: number, totalEur: number) =>
    ({ holdingId: 'h1', operationType: op, date, quantity, totalEur, commission: 0 });

  it('una venda parcial no canvia el cost mitjà i la compra següent pondera sobre el que queda', () => {
    const txs = [tx('2026-01-10', 'buy', 10, 100), tx('2026-02-10', 'sell', 5, 75), tx('2026-03-10', 'buy', 5, 150)];
    expect(holdingAt(h, txs, '2026-02-28')).toEqual({ quantity: 5, avgCost: 10 });
    expect(holdingAt(h, txs, '2026-03-31')).toEqual({ quantity: 10, avgCost: 20 });   // no 16,67
  });

  it('una posició entrada a mà després de la data no hi és', () => {
    const manual = { ...h, id: 'h2', createdAt: '2026-11-19T10:00:00Z' };
    expect(holdingAt(manual, [], '2026-10-31').quantity).toBe(0);
    expect(holdingAt(manual, [], '2026-11-30')).toEqual({ quantity: 10, avgCost: 20 });
  });
});

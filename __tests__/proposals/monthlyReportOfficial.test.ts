import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ getDb: () => null }));

import { saveDraft, approveProposal, __resetProposalsForTests, type ProposalItem, type ProposalParams } from '@/lib/proposals';
import { applyProposal } from '@/lib/proposalApply';
import { upsertNavs, getNavs, __resetNavsForTests } from '@/lib/fundNavs';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { buildOfficialSection, generateMonthlyReportData } from '@/lib/portfolioReport';
import { targetProposal } from '@/lib/portfolioAlertsServer';

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

describe('informe mensual amb valors liquidatius oficials', () => {
  beforeEach(async () => {
    __resetProposalsForTests(); __resetNavsForTests();
    await upsertNavs([
      { isin: A, date: '2026-08-31', nav: 40, currency: 'EUR' }, { isin: A, date: '2026-09-30', nav: 42, currency: 'EUR' }, { isin: A, date: '2026-10-30', nav: 44, currency: 'EUR' },
      { isin: B, date: '2026-08-31', nav: 90, currency: 'EUR' }, { isin: B, date: '2026-09-30', nav: 95, currency: 'EUR' }, { isin: B, date: '2026-10-30', nav: 110, currency: 'EUR' },
    ]);
  });

  it('octubre: resultat, operacions, pesos i reestructuració dins el període', async () => {
    const v1 = await approve('rep-1', [item(A, 60), item(B, 40)]);
    expect((await applyProposal({ clientId: 'rep-1', clientName: 'Anna', proposalId: v1.id, date: '2026-09-30', amount: 10000, broker: '', by: 'x' })).ok).toBe(true);
    const v2 = await approve('rep-1', [item(A, 100)]);
    expect((await applyProposal({ clientId: 'rep-1', clientName: 'Anna', proposalId: v2.id, date: '2026-10-30', amount: 1000, broker: '', by: 'x' })).ok).toBe(true);

    const port = (await getPortfolioByClientId('rep-1'))!;
    const navs = [...await getNavs(A), ...await getNavs(B)];
    const { target, lastApprovedAt } = await targetProposal(port);
    const o = buildOfficialSection(port, navs, target, lastApprovedAt, '2026-10-01', '2026-10-31');

    // 30/9: 10.000 €. 31/10: tot a A = 270,8475 × 44 = 11.917,29 €. Aportació neta 1.000 €.
    expect(o.performance).toMatchObject({ valueStart: 10000, valueEnd: 11917.29, netFlows: 1000, gain: 917.29, investedEnd: 11000 });
    expect(o.performance!.periodReturn).toBeCloseTo(917.29 / 10500 * 100, 2);   // Modified Dietz
    expect(o.performance!.cumulativeReturn).toBeCloseTo(917.29 / 11000 * 100, 2);
    expect(o.operations.map(x => [x.type, x.amount])).toEqual([['Venda', 4631.58], ['Compra', 5631.58]]);
    expect(o.allocation).toMatchObject({ targetVersion: 2, rows: [{ isin: A, target: 100, current: 100, diff: 0 }] });
    expect(o.evolution.map(p => p.date)).toEqual(['2026-09-30', '2026-10-30']);   // fins a l'últim VL oficial
  });

  it('setembre, abans de la reestructuració: pesos amb les participacions d\'aquell dia', async () => {
    const v1 = await approve('rep-2', [item(A, 60), item(B, 40)]);
    await applyProposal({ clientId: 'rep-2', clientName: 'Pau', proposalId: v1.id, date: '2026-09-30', amount: 10000, broker: '', by: 'x' });
    const v2 = await approve('rep-2', [item(A, 100)]);
    await applyProposal({ clientId: 'rep-2', clientName: 'Pau', proposalId: v2.id, date: '2026-10-30', amount: 0, broker: '', by: 'x' });
    const port = (await getPortfolioByClientId('rep-2'))!;
    const o = buildOfficialSection(port, [...await getNavs(A), ...await getNavs(B)], { version: 1, items: v1.items }, undefined, '2026-09-01', '2026-09-30');
    expect(o.performance).toMatchObject({ valueStart: 0, valueEnd: 10000, netFlows: 10000, gain: 0 });
    expect(o.allocation!.rows.map(r => [r.isin, r.current])).toEqual([[A, 60], [B, 40]]);
    expect(o.operations).toHaveLength(2);
  });

  it('sense preus a la data final no s\'inventa res', async () => {
    const v1 = await approve('rep-3', [item(A, 60), item(B, 40)]);
    await applyProposal({ clientId: 'rep-3', clientName: 'Laia', proposalId: v1.id, date: '2026-09-30', amount: 10000, broker: '', by: 'x' });
    const port = (await getPortfolioByClientId('rep-3'))!;
    const o = buildOfficialSection(port, [...await getNavs(A), ...await getNavs(B)], null, undefined, '2027-01-01', '2027-01-31');
    expect(o.performance).toBeNull();
    expect(o.note).toMatch(/2027-01-31/);
    const r = generateMonthlyReportData(port, '', '2027-01-01', '2027-01-31');
    expect(r.reportId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

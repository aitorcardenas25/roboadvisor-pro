import { describe, it, expect, beforeEach, vi } from 'vitest';
import ExcelJS from 'exceljs';

vi.mock('@/lib/supabase', () => ({ getDb: () => null }));

import {
  proposalStats, projection, roundWeights, itemsFromHoldings, fundToItem, fundOptions,
  validateForApproval, proposalToReportInput, saveDraft, approveProposal, getProposals,
  __resetProposalsForTests, type ProposalItem, type ProposalParams,
} from '@/lib/proposals';
import { buildProposalWorkbook } from '@/lib/proposalExcel';

const item = (isin: string, weight: number, extra: Partial<ProposalItem> = {}): ProposalItem => ({
  isin, name: isin, category: 'RV Global', weight, risk: 6, ter: 0.5, platform: '', justification: '', ...extra,
});
const params: ProposalParams = { profile: 'moderat', objective: 'Creixement', horizon: 10, initialAmount: 10000, monthlyAmount: 100, adminNote: '' };

describe('projection', () => {
  it('sense rendiment és la suma de les aportacions', () => {
    expect(projection(1000, 100, 0, 2)).toBe(1000 + 100 * 24);
  });
  it('capital únic amb interès compost mensual', () => {
    expect(projection(1000, 0, 12, 1)).toBeCloseTo(1000 * Math.pow(1.01, 12), 6);
  });
});

describe('proposalStats', () => {
  it('pondera rendiment, TER i volatilitat amb dades històriques quan n\'hi ha', () => {
    const s = proposalStats({ ...params, items: [
      item('A', 60, { historicalReturn5Y: 8, historicalVolatility: 15, ter: 0.2 }),
      item('B', 40, { historicalReturn5Y: 3, historicalVolatility: 5, ter: 0.5 }),
    ] });
    expect(s.weightOk).toBe(true);
    expect(s.grossReturn).toBeCloseTo(6, 10);
    expect(s.ter).toBeCloseTo(0.32, 10);
    expect(s.netReturn).toBeCloseTo(5.68, 10);
    expect(s.volatility).toBeCloseTo(11, 10);
    expect(s.estimatedFunds).toBe(0);
    expect(s.yearly).toHaveLength(11);
    expect(s.totalInvested).toBe(10000 + 100 * 120);
    expect(s.p10).toBeLessThan(s.p50);
    expect(s.p50).toBeLessThan(s.p90);
  });
  it('sense dades històriques fa servir les taules SRRI i ho compta', () => {
    const s = proposalStats({ ...params, items: [item('A', 100, { risk: 4, ter: 0 })] });
    expect(s.grossReturn).toBe(7);
    expect(s.volatility).toBe(11);
    expect(s.estimatedFunds).toBe(1);
  });
  it('detecta pesos que no sumen 100', () => {
    expect(proposalStats({ ...params, items: [item('A', 50), item('B', 30)] }).weightOk).toBe(false);
  });
});

describe('roundWeights', () => {
  it('arrodoneix a enters i manté la suma a 100', () => {
    const out = roundWeights([item('A', 33.3), item('B', 33.3), item('C', 33.4)]);
    expect(out.reduce((s, x) => s + x.weight, 0)).toBe(100);
    expect(out.every(x => Number.isInteger(x.weight))).toBe(true);
  });
});

describe('itemsFromHoldings', () => {
  it('calcula pesos pel valor de mercat i agrupa ISIN repetits', () => {
    const out = itemsFromHoldings([
      { assetIsin: 'IE00B42W4L06', assetName: 'Vanguard SC', assetCategory: 'RV', broker: 'MyInvestor', quantity: 10, currentPrice: 300 },
      { assetIsin: 'IE00B42W4L06', assetName: 'Vanguard SC', assetCategory: 'RV', broker: 'MyInvestor', quantity: 10, currentPrice: 300 },
      { assetIsin: 'LU0625737910', assetName: 'Pictet China', assetCategory: 'RV', broker: 'Inversis', quantity: 40, currentPrice: 100 },
    ]);
    expect(out).toHaveLength(2);
    expect(out.find(x => x.isin === 'IE00B42W4L06')?.weight).toBe(60);
    expect(out.find(x => x.isin === 'LU0625737910')?.platform).toBe('Inversis');
  });
  it('cartera buida → cap fons', () => {
    expect(itemsFromHoldings([])).toEqual([]);
  });
});

describe('fundToItem / fundOptions', () => {
  it('reconeix els fons de la llista de l\'assessor', () => {
    const f = fundToItem('ie00b42w4l06', 25);
    expect(f?.name).toMatch(/Vanguard Global Small-Cap/);
    expect(f?.weight).toBe(25);
    expect(f?.risk).toBe(6);
  });
  it('ISIN desconegut → null', () => {
    expect(fundToItem('US0378331005')).toBeNull();
  });
  it('les opcions no tenen ISIN repetits i comencen pels de l\'assessor', () => {
    const opts = fundOptions();
    expect(new Set(opts.map(o => o.isin)).size).toBe(opts.length);
    expect(opts[0].source).toBe('advisor');
  });
});

describe('validateForApproval', () => {
  it('accepta una proposta correcta', () => {
    expect(validateForApproval({ ...params, items: [item('A', 70), item('B', 30)] })).toBeNull();
  });
  it.each([
    [[], /cap fons/],
    [[item('A', 70), item('B', 20)], /sumen 90/],
    [[item('A', 100), item('B', 0)], /pes 0/],
    [[item('A', 50), item('A', 50)], /repetits/],
  ])('rebutja %#', (items, re) => {
    expect(validateForApproval({ ...params, items: items as ProposalItem[] })).toMatch(re);
  });
  it('rebutja sense imports', () => {
    expect(validateForApproval({ ...params, initialAmount: 0, monthlyAmount: 0, items: [item('A', 100)] })).toMatch(/import/);
  });
});

describe('versions (memòria)', () => {
  beforeEach(() => __resetProposalsForTests());

  it('desar dues vegades l\'esborrany no crea versions noves', async () => {
    const a = await saveDraft('c1', { ...params, items: [item('A', 100)] });
    const b = await saveDraft('c1', { ...params, items: [item('A', 60), item('B', 40)] });
    expect(a.version).toBe(1);
    expect(b.id).toBe(a.id);
    const all = await getProposals('c1');
    expect(all).toHaveLength(1);
    expect(all[0].items).toHaveLength(2);
  });

  it('després d\'aprovar, desar crea la versió següent i l\'aprovada no canvia', async () => {
    const d = await saveDraft('c1', { ...params, items: [item('A', 100)] });
    const r = await approveProposal('c1', d.id, 'admin@x');
    expect(r.ok).toBe(true);
    const v2 = await saveDraft('c1', { ...params, items: [item('B', 100)] });
    expect(v2.version).toBe(2);
    const all = await getProposals('c1');
    expect(all.map(p => [p.version, p.status])).toEqual([[2, 'draft'], [1, 'approved']]);
    expect(all[1].items[0].isin).toBe('A');
  });

  it('no aprova dues vegades ni propostes invàlides', async () => {
    const bad = await saveDraft('c1', { ...params, items: [item('A', 80)] });
    expect(await approveProposal('c1', bad.id, 'x')).toEqual({ ok: false, error: expect.stringMatching(/sumen/) });
    const ok = await saveDraft('c1', { ...params, items: [item('A', 100)] });
    await approveProposal('c1', ok.id, 'x');
    expect((await approveProposal('c1', ok.id, 'x')).ok).toBe(false);
  });

  it('les propostes d\'un client no es barregen amb les d\'un altre', async () => {
    await saveDraft('c1', { ...params, items: [item('A', 100)] });
    const other = await saveDraft('c2', { ...params, items: [item('B', 100)] });
    expect(other.version).toBe(1);
    expect(await getProposals('c2')).toHaveLength(1);
  });

  it('modificar l\'objecte retornat no altera el desat', async () => {
    const d = await saveDraft('c1', { ...params, items: [item('A', 100)] });
    d.items[0].weight = 1;
    expect((await getProposals('c1'))[0].items[0].weight).toBe(100);
  });
});

describe('informe i Excel', () => {
  beforeEach(() => __resetProposalsForTests());

  it('passa les dades personals del client a l\'informe', async () => {
    const p = await saveDraft('c1', { ...params, items: [item('A', 100)] });
    const input = proposalToReportInput(p, { name: 'Marta', email: 'm@x' }, { annualIncome: 36000, monthlyExpenses: 1500, netWorth: 90000 });
    expect(input.monthlyIncome).toBe(3000);
    expect(input.monthlyExpenses).toBe(1500);
    expect(input.patrimoni).toBe(90000);
    expect(input.assets[0].weight).toBe(100);
  });

  it('genera un Excel amb resum, fons i projecció', async () => {
    const p = await saveDraft('c1', { ...params, items: [item('A', 60), item('B', 40)] });
    const buf = await buildProposalWorkbook(p, 'Marta');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map(w => w.name)).toEqual(['Resum', 'Fons', 'Projecció']);
    const fons = wb.getWorksheet('Fons')!;
    expect(fons.getRow(2).getCell(5).value).toBe(6000);   // 60 % de 10.000 €
    expect(wb.getWorksheet('Projecció')!.rowCount).toBe(12); // capçalera + anys 0..10
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import ExcelJS from 'exceljs';

vi.mock('@/lib/supabase', () => ({ getDb: () => null }));

import {
  proposalStats, projection, roundWeights, itemsFromHoldings, fundToItem, fundOptions,
  validateForApproval, proposalToReportInput, saveDraft, approveProposal, getProposals, checkProposalSuitability,
  __resetProposalsForTests, hasPerformanceData, verifiedPerformance, type ProposalItem, type ProposalParams,
} from '@/lib/proposals';
import { buildProposalWorkbook } from '@/lib/proposalExcel';
import { ADVISOR_FUNDS, srriFromVolatility } from '@/lib/fundUniverse';

const item = (isin: string, weight: number, extra: Partial<ProposalItem> = {}): ProposalItem => ({
  isin, name: isin, category: 'RV Global', weight, risk: 6, ter: 0.5, platform: '', justification: '',
  historicalReturn5Y: 6, historicalVolatility: 12, performanceSource: 'Fitxa test', ...extra,
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
    expect(s.complete).toBe(true);
    expect(s.yearly).toHaveLength(11);
    expect(s.totalInvested).toBe(10000 + 100 * 120);
    expect(s.p10).toBeLessThan(s.p50);
    expect(s.p50).toBeLessThan(s.p90);
  });
  it('sense dades reals no s\'inventa el rendiment pel SRRI: proposta incompleta', () => {
    const s = proposalStats({ ...params, items: [
      item('A', 50),
      item('B', 50, { name: 'Fons B', historicalReturn5Y: undefined, historicalVolatility: undefined }),
    ] });
    expect(s.complete).toBe(false);
    expect(s.missing).toEqual([{ isin: 'B', name: 'Fons B' }]);
  });
  it('no es pot aprovar una proposta sense dades reals de tots els fons', () => {
    const items = [item('A', 50), item('B', 50, { name: 'Fons B', historicalVolatility: undefined })];
    expect(validateForApproval({ ...params, items })).toMatch(/Falten rendibilitat i volatilitat reals de: Fons B/);
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
    expect(f?.risk).toBe(6)   // SRRI per volatilitat (no el SRI 4 del KID);
  });
  it('les estimacions del catàleg (lib/products.ts) no compten com a dades reals', () => {
    const f = fundToItem('IE00B03HCZ61', 30); // Vanguard Global Stock (catàleg, dades estimades)
    expect(f).not.toBeNull();
    expect(f?.historicalReturn5Y).toBeUndefined();
    expect(hasPerformanceData(f!)).toBe(false);
  });
  it('xifres sense font no compten com a dades reals', () => {
    expect(hasPerformanceData(item('A', 100, { performanceSource: undefined }))).toBe(false);
    expect(hasPerformanceData(item('A', 100))).toBe(true);
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

  it('Excel d\'una proposta incompleta: cap xifra de rendiment ni projecció', async () => {
    const p = await saveDraft('c1', { ...params, items: [item('A', 100, { performanceSource: undefined })] });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await buildProposalWorkbook(p, 'Marta') as unknown as ArrayBuffer);
    const resum = wb.getWorksheet('Resum')!;
    const values = resum.getColumn(2).values.filter(v => v != null);
    expect(values.filter(v => v === 'Dades no disponibles')).toHaveLength(6);
    const proj = wb.getWorksheet('Projecció')!;
    expect(proj.rowCount).toBe(2);
    expect(String(proj.getRow(2).getCell(1).value)).toMatch(/no disponible/);
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

describe('checkProposalSuitability', () => {
  const q = { financialKnowledge: 'intermedi', liquidityNeed: 'no-necessito', investmentHorizon: 10 };

  it('moderat amb risc mitjà raonable i qüestionari coherent → idònia', () => {
    const r = checkProposalSuitability({ profile: 'moderat', horizon: 10, items: [item('A', 50, { risk: 5 }), item('B', 50, { risk: 3 })] }, q, 'moderat');
    expect(r.status).toBe('adequate');
  });
  it('conservador amb 100 % SRRI 7 → no idònia', () => {
    const r = checkProposalSuitability({ profile: 'conservador', horizon: 10, items: [item('A', 100, { risk: 7 })] }, q);
    expect(r.status).toBe('inadequate');
    expect(r.issues.map(i => i.message).join(' ')).toMatch(/Risc mitjà SRRI 7\.0/);
  });
  it('necessitat de liquiditat amb cartera de risc → no idònia', () => {
    const r = checkProposalSuitability({ profile: 'agressiu', horizon: 10, items: [item('A', 100, { risk: 6 })] }, { ...q, liquidityNeed: 'necessito-ja' });
    expect(r.status).toBe('inadequate');
  });
  it('horitzó curt amb molta renda variable → no idònia', () => {
    const r = checkProposalSuitability({ profile: 'agressiu', horizon: 2, items: [item('A', 100, { risk: 6 })] }, q);
    expect(r.status).toBe('inadequate');
  });
  it('sense qüestionari o amb perfil diferent → avís', () => {
    expect(checkProposalSuitability({ profile: 'moderat', horizon: 10, items: [item('A', 100, { risk: 4 })] }).status).toBe('borderline');
    const r = checkProposalSuitability({ profile: 'dinamic', horizon: 10, items: [item('A', 100, { risk: 5 })] }, q, 'conservador');
    expect(r.status).toBe('borderline');
    expect(r.issues[0].message).toMatch(/conservador/);
  });
});

describe('aprovació concurrent (memòria)', () => {
  beforeEach(() => __resetProposalsForTests());

  it('no aprova si l\'esborrany ha canviat des que es va revisar', async () => {
    const d = await saveDraft('c1', { ...params, items: [item('A', 100)] });
    await new Promise(r => setTimeout(r, 2));
    await saveDraft('c1', { ...params, items: [item('B', 100)] });
    const r = await approveProposal('c1', d.id, 'x', { expectedUpdatedAt: d.updatedAt });
    expect(r.ok).toBe(false);
    expect((await getProposals('c1'))[0].status).toBe('draft');
  });

  it('desa el resultat d\'idoneïtat i el motiu amb la versió aprovada', async () => {
    const d = await saveDraft('c1', { ...params, items: [item('A', 100)] });
    const suitability = { status: 'inadequate' as const, issues: [{ level: 'inadequate' as const, message: 'x' }] };
    await approveProposal('c1', d.id, 'x', { suitability, suitabilityOverride: 'Ho demana el client', expectedUpdatedAt: d.updatedAt });
    const [p] = await getProposals('c1');
    expect(p.status).toBe('approved');
    expect(p.suitability?.status).toBe('inadequate');
    expect(p.suitabilityOverride).toBe('Ho demana el client');
  });
});

describe('Fitxes carregades (ADVISOR_FUNDS)', () => {
  it('Invesco LU2305834041 té dades reals amb font', () => {
    const v = verifiedPerformance('LU2305834041');
    expect(v.historicalReturn5Y).toBe(3.45);
    expect(v.historicalVolatility).toBe(17.16);
    expect(v.performanceSource).toMatch(/Invesco/);
  });
  it('un fons sense rendibilitat a 5 anys no compta com a dada real', () => {
    expect(verifiedPerformance('IE00B42W4L06').historicalReturn5Y).toBeUndefined();
    expect(fundToItem('IE00B42W4L06', 10)?.ter).toBe(0.3);
  });
  it('el SRRI de cada fons quadra amb la seva volatilitat (bandes ESMA), no amb el SRI del KID', () => {
    expect(srriFromVolatility(4.9)).toBe(3);
    expect(srriFromVolatility(15.66)).toBe(6);
    expect(srriFromVolatility(30)).toBe(7);
    for (const f of ADVISOR_FUNDS) {
      if (f.srri && f.volatility !== undefined) expect(f.srri).toBe(srriFromVolatility(f.volatility));
    }
  });
});

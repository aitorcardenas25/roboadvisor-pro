import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildExportTables, buildClientsWorkbook, ageBand, clientsExportFilename, clientAlerts, type ExportClientInput } from '@/lib/clientsExport';

const NOW = new Date('2026-11-25T10:00:00Z');

function client(over: Partial<ExportClientInput> = {}): ExportClientInput {
  return {
    id: 'u1', name: 'Anna Prova', username: 'anna', email: 'anna@example.com', active: true,
    createdAt: '2026-11-10T09:00:00Z', phone: '600000000',
    questionnaire: {
      age: 27, employmentType: 'indefinit', dependents: 0, selfRiskProfile: 'equilibrat', selfKnowledge: 'basic',
      monthlyNetIncome: 2000, monthlyFixedExpenses: 1000, monthlyVariableExpenses: 400, monthlyDebtPayments: 100,
      currentSavings: 4500,
      goals: [
        { horizon: 'mitja', description: 'Entrada pis', amount: 30000, targetYear: 2030 },
        { horizon: 'curt', description: 'Viatge', amount: 1500, targetYear: 2027 },
      ],
      notes: 'nota privada',
    },
    stage: 'dades',
    consentAt: '2026-11-11T08:00:00Z', surveyOptIn: true,
    usage: { lastSeen: '2026-11-24T18:00:00Z', daysActive30: 6, minutes30: 42, logins30: 5 },
    wealth: null,
    proposals: [{ version: 1, status: 'approved', profile: 'moderat', horizon: 5 }, { version: 2, status: 'draft', profile: 'dinamic', horizon: 8 }],
    holdings: [
      { isin: 'IE00B4L5Y983', name: 'iShares Core MSCI World', broker: 'MyInvestor', category: 'RV Global', quantity: 10, price: 100.5, priceDate: '2026-11-21' },
      { isin: 'ES0114561006', name: 'Bestinver Grandes Cías', broker: 'Bestinver', category: 'RV', quantity: 3, price: 0, priceSource: 'pending' },
      { isin: 'LU0000000000', name: 'Venut', broker: 'X', category: 'RV', quantity: 0, price: 10 },
    ],
    ...over,
  };
}

describe('buildExportTables', () => {
  it('fa una fila per client amb les dades de l\'Excel i els càlculs del pressupost', () => {
    const t = buildExportTables([client()], { now: NOW });
    const r = t.clients[0];
    expect(r.client).toBe('Anna Prova');
    expect(r.email).toBe('anna@example.com');
    expect(r.age).toBe(27);
    expect(r.employment).toBe('Indefinit');
    expect(r.margin).toBe(500);              // 2000 − 1000 − 400 − 100
    expect(r.savingsRate).toBe(25);          // 500 / 2000
    expect(r.emTarget).toBe(9000);           // 6 mesos × 1500
    expect(r.emPct).toBe(50);                // 4500 / 9000
    expect(r.survey).toBe('Sí');
    expect(r.newsletter).toMatch(/^NO/);
    expect(r.propProfile).toBe('Dinàmic');   // darrera versió
    expect(r.propVersions).toBe(2);
    expect(r.goalsN).toBe(2);
    expect(r.goalNext).toBe('Viatge');       // el més proper
  });

  it('no inventa dades: un client sense fitxa té les cel·les buides', () => {
    const t = buildExportTables([client({ questionnaire: null, consentAt: null, surveyOptIn: null, proposals: [], holdings: [] })], { now: NOW });
    const r = t.clients[0];
    expect(r.age).toBeNull();
    expect(r.income).toBeNull();
    expect(r.margin).toBeNull();
    expect(r.survey).toBeNull();
    expect(r.diagStatus).toBe('Falten dades');
    expect(r.propProfile).toBeNull();
  });

  it('no exporta les notes internes', () => {
    const t = buildExportTables([client()], { now: NOW });
    expect(JSON.stringify(t)).not.toContain('nota privada');
  });

  it('posicions: salta les venudes i no posa valor a les pendents de preu', () => {
    const t = buildExportTables([client()], { now: NOW });
    expect(t.holdings).toHaveLength(2);
    expect(t.holdings[0].value).toBe(1005);
    expect(t.holdings[1].value).toBeNull();
    expect(t.holdings[1].status).toBe('Pendent de preu');
  });

  it('anonimitza: sense nom, usuari, correu ni telèfon, edat en franges', () => {
    const b = client({ id: 'u2', name: 'Bernat', email: 'bernat@example.com', createdAt: '2026-11-01T00:00:00Z' });
    const t = buildExportTables([client(), b], { now: NOW, anonymize: true });
    const json = JSON.stringify(t);
    for (const s of ['Anna', 'Bernat', 'anna@example.com', '600000000', '"anna"']) expect(json).not.toContain(s);
    expect(t.columns.some(c => c.key === 'email')).toBe(false);
    expect(t.clients[0].client).toBe('Client 01');   // Bernat, alta més antiga
    expect(t.clients[1].age).toBe('25-34');
    expect(t.goals.every(g => String(g.client).startsWith('Client '))).toBe(true);
    expect((t.clients[1].createdAt as Date).getUTCDate()).toBe(1);   // només el mes
  });
});

describe('buildClientsWorkbook', () => {
  it('genera un Excel amb les 4 pestanyes i una fila per client', async () => {
    const buf = await buildClientsWorkbook([client()], { now: NOW });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map(w => w.name)).toEqual(['Llegeix-me', 'Clients', 'Objectius', 'Posicions']);
    const ws = wb.getWorksheet('Clients')!;
    expect(ws.rowCount).toBe(2);
    expect(ws.getRow(1).getCell(1).value).toBe('Client');
    expect(wb.getWorksheet('Objectius')!.rowCount).toBe(3);
  });
});

describe('clientAlerts', () => {
  it('client sa: cap alerta', () => {
    expect(clientAlerts({ monthlyNetIncome: 2000, monthlyFixedExpenses: 900, monthlyVariableExpenses: 300, monthlyDebtPayments: 0, currentSavings: 20000, employmentType: 'indefinit' }, 'moderat')).toEqual([]);
  });
  it('client delicat: suma els senyals', () => {
    const a = clientAlerts({
      monthlyNetIncome: 1500, monthlyFixedExpenses: 900, monthlyVariableExpenses: 300, monthlyDebtPayments: 600,
      currentSavings: 500, employmentType: 'temporal', consumerDebt: 8000, dependents: 1,
      incomeOutlook: 'baixaran', drawdownReaction: 'vendre-tot', selfRiskProfile: 'dinamic', investingExperience: 'mai',
    }, 'dinamic');
    expect(a).toContain('Gasta igual o més del que ingressa');
    expect(a.some(x => x.startsWith('Quotes de deutes > 35 %'))).toBe(true);
    expect(a.some(x => x.startsWith('Té deute de consum'))).toBe(true);
    expect(a).toContain('Creu que els seus ingressos baixaran');
    expect(a).toContain('Perfil dinàmic però vendria tot si baixa un 20 %');
    expect(a).toContain('Mai ha invertit i la proposta és dinàmica o agressiva');
    expect(a.length).toBeGreaterThanOrEqual(7);
  });
  it('persones a càrrec sense saber l\'estalvi: no és alerta', () => {
    expect(clientAlerts({ monthlyNetIncome: 2000, monthlyFixedExpenses: 900, monthlyVariableExpenses: 300, dependents: 2 })).toEqual([]);
  });
  it('sense dades: cap alerta inventada', () => {
    expect(clientAlerts(null)).toEqual([]);
  });
});

describe('helpers', () => {
  it('ageBand', () => {
    expect(ageBand(19)).toBe('18-24');
    expect(ageBand(35)).toBe('35-44');
    expect(ageBand(70)).toBe('65+');
  });
  it('nom del fitxer amb la data de Madrid', () => {
    expect(clientsExportFilename(NOW, false)).toBe('FACTOR_OTC_clients_2026-11-25.xlsx');
    expect(clientsExportFilename(NOW, true)).toBe('FACTOR_OTC_clients_2026-11-25_anonimitzat.xlsx');
  });
});

describe('v5: altres ingressos mensuals a l\'exportació', () => {
  it('columna pròpia i marge calculat amb sou + altres', () => {
    const c = client();
    c.questionnaire = { ...c.questionnaire, monthlyOtherIncome: 300 };
    const t = buildExportTables([c], { now: NOW });
    expect(t.columns.some(col => col.key === 'otherIncome')).toBe(true);
    expect(t.clients[0].otherIncome).toBe(300);
    expect(t.clients[0].income).toBe(2000);
    expect(t.clients[0].margin).toBe(800);   // 2000 + 300 − 1000 − 400 − 100
  });
  it('la ràtio de deute fa servir els ingressos totals', () => {
    const q = { monthlyNetIncome: 1000, monthlyOtherIncome: 500, monthlyFixedExpenses: 300, monthlyVariableExpenses: 100, monthlyDebtPayments: 400, currentSavings: 50000, employmentType: 'indefinit' };
    expect(clientAlerts(q).some(a => /35 %/.test(a))).toBe(false);   // 400/1500 = 27 %
  });
});

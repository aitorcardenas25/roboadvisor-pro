// Regressió: els informes PDF no han de tenir pàgines en blanc o gairebé buides.
// Cada secció de l'informe inicial (ManualReportPDF) és una <Page>; si una secció
// es desborda per poc (p. ex. el marge inferior d'un requadre), react-pdf afegeix
// un full amb només la capçalera i el peu. Amb una cartera normal (com la d'una
// clienta real de la beta: 4 fons) el PDF ha de tenir exactament una pàgina per secció.
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { ManualReportPDF } from '@/components/pdf/ManualReportPDF';
import { proposalToReportInput, type ClientProposal } from '@/lib/proposalMath';
import { computeFundDrawdowns } from '@/lib/drawdowns';
import { generateManualReport } from '@/lib/manualReport';
import { PRINT_PAGE_CSS, PRINT_FIT_SCRIPT } from '@/lib/printPages';

const items = [
  { isin: 'LU0996182563', name: 'Amundi Index MSCI World Fund', category: 'Renda Variable Global Indexada', risk: 5, weight: 55, ter: 0.18, beta: 1, platform: 'MyInvestor', justification: 'Alternativa indexada al MSCI World amb TER competitiu.', historicalReturn5Y: 10.13, historicalVolatility: 13.27 },
  { isin: 'IE0008248803', name: 'Vanguard Eurozone Stock Index Fund EUR Acc', category: 'RV Eurozona', risk: 6, weight: 15, ter: 0.12, beta: 0.82, platform: 'MyInvestor', justification: '', historicalReturn5Y: 10.07, historicalVolatility: 14.16 },
  { isin: 'LU0996177134', name: 'Amundi Core MSCI Emerging Markets AE Acc', category: 'RV Emergents', risk: 6, weight: 10, ter: 0.45, beta: 0.7, platform: 'MyInvestor', justification: '', historicalReturn5Y: 6.52, historicalVolatility: 15.73 },
  { isin: 'IE0007472115', name: 'Vanguard Euro Government Bond Index Fund EUR Acc', category: 'RF Govern Euro', risk: 3, weight: 20, ter: 0.12, beta: 0.3, platform: 'MyInvestor', justification: '', historicalReturn5Y: -2.74, historicalVolatility: 6.48 },
];
const proposal = {
  id: 'prop-test', clientId: 'user-test', version: 4, status: 'approved',
  items, horizon: 10, profile: 'dinamic', adminNote: 'Estat actual financer.\n25/11/2026',
  objective: "Entrada d'un pis i jubilació", initialAmount: 4618, monthlyAmount: 250,
  createdAt: '2026-11-25T20:32:13.148Z', updatedAt: '2026-11-25T20:32:13.855Z', approvedAt: '2026-11-25T20:32:13.855Z',
} as unknown as ClientProposal;
const personal = {
  age: 22, netWorth: 6500, totalDebt: 2200, currentSavings: 6500, monthlyNetIncome: 2500,
  monthlyFixedExpenses: 700, monthlyVariableExpenses: 400, monthlyExpenses: 1100, employmentType: 'temporal',
  goals: [
    { description: 'viatge', amount: 1000, horizon: 'curt', targetYear: 2027 },
    { description: 'marxar a l\'estranger', amount: 10000, horizon: 'mitja', targetYear: 2030 },
    { description: 'comprar un pis', amount: 70000, horizon: 'llarg', targetYear: 2034 },
  ],
};

function navSeries(seed: number) {
  let v = 100, s = seed; const pts: { date: string; nav: number }[] = [];
  for (let y = 2016; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
    s = (s * 9301 + 49297) % 233280;
    v *= 1 + (s / 233280 - 0.47) * 0.08 - ((y === 2020 && m === 3) || (y === 2022 && m < 10) ? 0.06 : 0);
    pts.push({ date: `${y}-${String(m).padStart(2, '0')}-28`, nav: v });
  }
  return pts;
}

async function pagesAndSections(profile: string, withDrawdowns: boolean, adminNote = proposal.adminNote) {
  const data = proposalToReportInput({ ...proposal, profile, adminNote } as ClientProposal, { name: 'Clienta de Prova Exemple', email: 'prova@example.com' }, personal);
  const drawdowns = withDrawdowns ? items.map((x, i) => computeFundDrawdowns({ isin: x.isin, name: x.name }, navSeries(i + 3))) : undefined;
  const props = { data, generatedAt: '25 de novembre de 2026', drawdowns };
  // Seccions = fills no buits del <Document> (cadascun és una <Page>)
  const doc = ManualReportPDF(props) as React.ReactElement<{ children: React.ReactNode }>;
  const sections = React.Children.toArray(doc.props.children).length;
  const buf = await renderToBuffer(React.createElement(ManualReportPDF, props) as Parameters<typeof renderToBuffer>[0]);
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
  return { pages, sections };
}

describe('Informe inicial (PDF) sense pàgines en blanc', () => {
  it('perfil dinàmic: una pàgina per secció', async () => {
    const { pages, sections } = await pagesAndSections('dinamic', false);
    expect(sections).toBeGreaterThan(10);
    expect(pages).toBe(sections);
  }, 60_000);

  it('perfil conservador amb caigudes històriques: una pàgina per secció', async () => {
    const { pages, sections } = await pagesAndSections('conservador', true);
    expect(pages).toBe(sections);
  }, 60_000);

  it('amb fons actius sense fitxa de diversificació: una pàgina per secció', async () => {
    const mixed = [
      ...items.slice(0, 2).map(x => ({ ...x, weight: 30 })),
      { ...items[0], isin: 'ES0112611001', name: 'Azvalor Internacional FI', weight: 15 },
      { ...items[0], isin: 'ES0119199000', name: 'Cobas Internacional FI Clase C', weight: 15 },
      { ...items[0], isin: 'LU2305834041', name: 'Invesco Continental European Small Cap Equity A EUR Acc', weight: 10 },
    ];
    const data = proposalToReportInput({ ...proposal, items: mixed } as ClientProposal, { name: 'Clienta de Prova Exemple', email: 'prova@example.com' }, personal);
    const props = { data, generatedAt: '25 de novembre de 2026' };
    const doc = ManualReportPDF(props) as React.ReactElement<{ children: React.ReactNode }>;
    const sections = React.Children.toArray(doc.props.children).length;
    const buf = await renderToBuffer(React.createElement(ManualReportPDF, props) as Parameters<typeof renderToBuffer>[0]);
    if (process.env.SAVE_PDF) (await import('node:fs')).writeFileSync(process.env.SAVE_PDF, buf);
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
    expect(pages).toBe(sections);
  }, 60_000);

  it('una nota de l\'assessor molt llarga continua a la pàgina següent (no es talla)', async () => {
    const note = Array.from({ length: 100 }, (_, i) => `Línia ${i + 1} de la nota`).join('\n');
    const { pages, sections } = await pagesAndSections('dinamic', false, note);
    expect(pages).toBeGreaterThan(sections);
  }, 60_000);
});

describe('Informes HTML: impressió sense fulls buits', () => {
  it('l\'informe manual porta la mida de full i l\'ajust d\'impressió', () => {
    const html = generateManualReport(proposalToReportInput(proposal, { name: 'Clienta de Prova', email: 'prova@example.com' }, personal));
    expect(html).toContain(PRINT_PAGE_CSS);
    expect(html).toContain(PRINT_FIT_SCRIPT);
  });
});

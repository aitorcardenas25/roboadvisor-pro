// lib/proposalExcel.ts
// Excel de la proposta de cartera: resum, fons amb imports i projecció any a any.
import ExcelJS from 'exceljs';
import { proposalStats, type ClientProposal } from './proposalMath';

const GREEN = 'FF14281D';
const GOLD  = 'FFC9A84C';
const EUR   = '#,##0.00 "€"';
const PCT   = '0.00" %"';

function header(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }; });
}

export async function buildProposalWorkbook(p: ClientProposal, clientName: string): Promise<Buffer> {
  const s = proposalStats(p);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FACTOR OTC';
  wb.created = new Date();

  // ── Resum ──
  const r = wb.addWorksheet('Resum');
  r.columns = [{ width: 34 }, { width: 28 }];
  r.addRow(['FACTOR OTC · Proposta de cartera']).font = { bold: true, size: 14, color: { argb: GREEN } };
  r.addRow([]);
  const rows: [string, string | number, string?][] = [
    ['Client', clientName],
    ['Versió', p.version],
    ['Estat', p.status === 'approved' ? 'Aprovada' : 'Esborrany'],
    ['Data d\'aprovació', p.approvedAt ? new Date(p.approvedAt).toLocaleDateString('ca-ES') : '—'],
    ['Perfil', p.profile],
    ['Objectiu', p.objective || '—'],
    ['Horitzó (anys)', p.horizon],
    ['Import inicial', p.initialAmount, EUR],
    ['Aportació mensual', p.monthlyAmount, EUR],
    ['Rendiment brut estimat (anual)', s.grossReturn, PCT],
    ['Cost (TER) ponderat', s.ter, PCT],
    ['Rendiment net estimat (anual)', s.netReturn, PCT],
    ['Volatilitat estimada (anual)', s.volatility, PCT],
    ['Risc SRRI ponderat (1–7)', Number(s.risk.toFixed(1))],
    [`Total aportat en ${p.horizon} anys`, s.totalInvested, EUR],
    ['Escenari desfavorable (P10)', s.p10, EUR],
    ['Escenari central (P50)', s.p50, EUR],
    ['Escenari favorable (P90)', s.p90, EUR],
  ];
  for (const [k, v, fmt] of rows) {
    const row = r.addRow([k, v]);
    row.getCell(1).font = { color: { argb: 'FF6C6C6C' } };
    if (fmt) row.getCell(2).numFmt = fmt;
  }
  if (p.adminNote) { r.addRow([]); r.addRow(['Nota de l\'assessor']).font = { bold: true }; r.addRow([p.adminNote]); }
  r.addRow([]);
  r.addRow([
    'Rendibilitats i volatilitats històriques anualitzades de cada fons (catàleg o fitxa del fons). ' +
    'Rendiments passats no garanteixen rendiments futurs.',
  ]).font = { italic: true, size: 9, color: { argb: 'FF6C6C6C' } };
  if (!s.complete) {
    r.addRow([`Falten dades reals de ${s.missing.length} fons: les xifres de rendiment i projecció no són vàlides.`]).font = { italic: true, size: 9, color: { argb: GOLD } };
  }

  // ── Fons ──
  const f = wb.addWorksheet('Fons');
  f.columns = [
    { header: 'ISIN', width: 15 }, { header: 'Fons', width: 48 }, { header: 'Categoria', width: 24 },
    { header: 'Pes (%)', width: 9 }, { header: 'Import inicial (€)', width: 17 }, { header: 'Aportació mensual (€)', width: 19 },
    { header: 'SRRI', width: 6 }, { header: 'TER (%)', width: 9 }, { header: 'Plataforma', width: 18 }, { header: 'Justificació', width: 60 },
  ];
  header(f.getRow(1));
  for (const x of p.items) {
    const row = f.addRow([
      x.isin, x.name, x.category, x.weight,
      p.initialAmount * x.weight / 100, p.monthlyAmount * x.weight / 100,
      x.risk, x.ter, x.platform, x.justification,
    ]);
    row.getCell(5).numFmt = EUR; row.getCell(6).numFmt = EUR; row.getCell(8).numFmt = '0.00';
    row.getCell(10).alignment = { wrapText: true, vertical: 'top' };
  }
  const tot = f.addRow(['', 'Total', '', s.totalWeight, p.initialAmount, p.monthlyAmount, '', s.ter]);
  tot.font = { bold: true };
  tot.getCell(5).numFmt = EUR; tot.getCell(6).numFmt = EUR; tot.getCell(8).numFmt = '0.00';

  // ── Projecció ──
  const y = wb.addWorksheet('Projecció');
  y.columns = [
    { header: 'Any', width: 8 }, { header: 'Aportat (€)', width: 16 },
    { header: 'Desfavorable P10 (€)', width: 20 }, { header: 'Central P50 (€)', width: 18 }, { header: 'Favorable P90 (€)', width: 18 },
  ];
  header(y.getRow(1));
  const startYear = new Date(p.approvedAt ?? p.updatedAt).getFullYear();
  for (const pt of s.yearly) {
    const row = y.addRow([startYear + pt.year, pt.invested, pt.p10, pt.p50, pt.p90]);
    for (let c = 2; c <= 5; c++) row.getCell(c).numFmt = EUR;
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

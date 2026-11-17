// lib/portfolioExcel.ts
// Excel de l'evolució de la cartera REAL del client per mesos, trimestres o
// anys, calculada amb els valors liquidatius oficials (fund_navs).
// El descarreguen el client (la seva cartera) i l'assessor (fitxa del client).
import ExcelJS from 'exceljs';
import type { ClientPortfolio } from './clientPortfolios';
import { computeMetrics } from './clientPortfolios';
import { getNavs } from './fundNavs';
import { aggregatePeriods, valuationSeries, type Period, type Valuation } from './portfolioValuation';

const GREEN = 'FF14281D';
const EUR   = '#,##0.00 "€"';
const PCT   = '0.00" %"';
const QTY   = '#,##0.000000';

export const PERIOD_LABEL: Record<Period, string> = { month: 'Mensual', quarter: 'Trimestral', year: 'Anual' };

/** Valoració amb preus oficials dels fons que té la cartera. */
export async function loadValuation(portfolio: ClientPortfolio): Promise<Valuation | null> {
  if (!portfolio.holdings.length) return null;
  const isins = [...new Set(portfolio.holdings.map(h => (h.assetIsin ?? '').toUpperCase()).filter(Boolean))];
  const navs = (await Promise.all(isins.map(i => getNavs(i)))).flat();
  return valuationSeries(portfolio.holdings, portfolio.transactions, navs);
}

function header(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }; });
}

const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('ca-ES', { timeZone: 'UTC' });

export async function buildPortfolioWorkbook(portfolio: ClientPortfolio, clientName: string, valuation: Valuation | null, period: Period): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FACTOR OTC';
  wb.created = new Date();
  const m = computeMetrics(portfolio);
  const rows = aggregatePeriods(valuation?.points ?? [], period);

  // ── Evolució ──
  const e = wb.addWorksheet('Evolució');
  e.columns = [{ width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 18 }];
  e.addRow([`FACTOR OTC · Evolució de la cartera (${PERIOD_LABEL[period].toLowerCase()})`]).font = { bold: true, size: 14, color: { argb: GREEN } };
  e.addRow([`Client: ${clientName}`]);
  e.addRow([`Generat el ${new Date().toLocaleDateString('ca-ES')}`]).font = { color: { argb: 'FF6C6C6C' } };
  e.addRow([]);
  if (!rows.length) {
    const why = valuation?.missing.length
      ? `No es pot calcular: falten els valors liquidatius oficials de ${valuation.missing.join(', ')}.`
      : 'Encara no hi ha prou dades per calcular l\'evolució.';
    e.addRow([why]).font = { italic: true };
  } else {
    header(e.addRow(['Data', 'Valor (€)', 'Capital aportat (€)', 'Aportacions del període (€)', 'Guany del període (€)', 'Rendibilitat del període', 'Rendibilitat acumulada']));
    for (const r of rows) {
      const row = e.addRow([fmtDate(r.date), r.value, r.invested, r.flow, r.gain, r.periodReturn, r.totalReturn]);
      for (const c of [2, 3, 4, 5]) row.getCell(c).numFmt = EUR;
      for (const c of [6, 7]) row.getCell(c).numFmt = PCT;
    }
    e.addRow([]);
    e.addRow([
      'Valor = participacions × valor liquidatiu oficial de cada fons a la data (o l\'últim dia anterior amb preu). ' +
      'La rendibilitat del període descompta les aportacions (mètode Modified Dietz). Rendiments passats no garanteixen rendiments futurs.',
    ]).font = { italic: true, size: 9, color: { argb: 'FF6C6C6C' } };
  }

  // ── Posicions ──
  const p = wb.addWorksheet('Posicions');
  p.columns = [
    { header: 'ISIN', width: 15 }, { header: 'Fons', width: 46 }, { header: 'Categoria', width: 22 }, { header: 'Entitat', width: 16 },
    { header: 'Participacions', width: 16 }, { header: 'Preu mitjà (€)', width: 15 }, { header: 'Preu actual (€)', width: 15 },
    { header: 'Data del preu', width: 14 }, { header: 'Valor (€)', width: 16 }, { header: 'Pes (%)', width: 9 },
  ];
  header(p.getRow(1));
  for (const h of portfolio.holdings) {
    const value = h.currentPrice * h.quantity;
    const row = p.addRow([
      h.assetIsin, h.assetName, h.assetCategory, h.broker, h.quantity, h.avgEntryPrice, h.currentPrice,
      h.priceLastUpdated ? fmtDate(h.priceLastUpdated.slice(0, 10)) : '', value, m.currentValue > 0 ? value / m.currentValue * 100 : null,
    ]);
    row.getCell(5).numFmt = QTY;
    for (const c of [6, 7, 9]) row.getCell(c).numFmt = EUR;
    row.getCell(10).numFmt = '0.00';
  }
  const tot = p.addRow(['', 'Total', '', '', '', '', '', '', m.currentValue, m.currentValue > 0 ? 100 : null]);
  tot.font = { bold: true }; tot.getCell(9).numFmt = EUR;

  // ── Operacions ──
  const o = wb.addWorksheet('Operacions');
  o.columns = [
    { header: 'Data', width: 12 }, { header: 'Tipus', width: 14 }, { header: 'Fons', width: 46 }, { header: 'Participacions', width: 16 },
    { header: 'Preu (€)', width: 13 }, { header: 'Import (€)', width: 15 }, { header: 'Comissió (€)', width: 13 }, { header: 'Entitat', width: 16 },
  ];
  header(o.getRow(1));
  const TYPE: Record<string, string> = { buy: 'Compra', sell: 'Venda', deposit: 'Aportació', withdrawal: 'Retirada', rebalance: 'Rebalanceig' };
  for (const t of [...portfolio.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    const row = o.addRow([fmtDate(t.date.slice(0, 10)), TYPE[t.operationType] ?? t.operationType, t.assetName ?? t.ticker ?? '', t.quantity, t.priceEur, t.totalEur, t.commission, t.broker]);
    row.getCell(4).numFmt = QTY;
    for (const c of [5, 6, 7]) row.getCell(c).numFmt = EUR;
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function excelResponseHeaders(clientName: string, period: Period) {
  const safe = clientName.normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'client';
  return {
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="FACTOR_OTC_evolucio_${safe}_${PERIOD_LABEL[period].toLowerCase()}.xlsx"`,
    'Cache-Control':       'no-store',
  };
}

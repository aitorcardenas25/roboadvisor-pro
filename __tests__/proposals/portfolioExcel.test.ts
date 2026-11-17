import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildPortfolioWorkbook } from '@/lib/portfolioExcel';
import { valuationSeries } from '@/lib/portfolioValuation';
import type { ClientPortfolio } from '@/lib/clientPortfolios';

const A = 'IE00B03HD191';
const portfolio: ClientPortfolio = {
  id: 'p1', clientId: 'c1', clientName: 'Anna', name: 'Cartera', description: '', recommendations: '',
  holdings: [{ id: 'h1', portfolioId: 'p1', assetIsin: A, assetName: 'Vanguard Global Stock', assetCategory: 'RV Global', broker: 'MyInvestor',
    quantity: 100, avgEntryPrice: 40, currentPrice: 46, priceLastUpdated: '2026-12-31', priceSource: 'manual', currency: 'EUR', createdAt: '2026-01-31' }],
  transactions: [{ id: 't1', portfolioId: 'p1', holdingId: 'h1', operationType: 'buy', date: '2026-01-31', quantity: 100, priceEur: 40, totalEur: 4000, commission: 0, broker: 'MyInvestor', createdAt: '2026-01-31' }],
  advisorNotes: [], snapshots: [], createdAt: '2026-01-31', updatedAt: '2026-01-31',
};
const navs = Array.from({ length: 12 }, (_, i) => ({
  isin: A, date: new Date(Date.UTC(2026, i + 1, 0)).toISOString().slice(0, 10), nav: 40 + i * 0.5, currency: 'EUR',
}));

async function sheet(period: 'month' | 'quarter' | 'year', withValuation = true) {
  const v = withValuation ? valuationSeries(portfolio.holdings, portfolio.transactions, navs, '2027-01-15') : null;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await buildPortfolioWorkbook(portfolio, 'Anna', v, period) as unknown as ArrayBuffer);
  return wb;
}

describe('buildPortfolioWorkbook', () => {
  it('evolució mensual amb valor, capital i rendibilitats', async () => {
    const wb = await sheet('month');
    const e = wb.getWorksheet('Evolució')!;
    const rows = e.getSheetValues().filter(Boolean) as unknown[][];
    const data = rows.filter(r => typeof r[2] === 'number');
    expect(data).toHaveLength(12);                       // gen → des
    expect(data[0].slice(2, 4)).toEqual([4000, 4000]);
    expect(data[11][2]).toBe(4550);                       // 100 × 45,5
    expect(data[11][7]).toBe(13.75);                      // acumulat
    expect(wb.getWorksheet('Posicions')!.getRow(2).getCell(1).value).toBe(A);
    expect(wb.getWorksheet('Operacions')!.getRow(2).getCell(2).value).toBe('Compra');
  });

  it('trimestral i anual agrupen; sense preus explica per què no hi ha evolució', async () => {
    const q = (await sheet('quarter')).getWorksheet('Evolució')!.getSheetValues().filter(r => r && typeof (r as unknown[])[2] === 'number');
    expect(q).toHaveLength(5);   // inici + mar, jun, set, des
    const y = (await sheet('year')).getWorksheet('Evolució')!.getSheetValues().filter(r => r && typeof (r as unknown[])[2] === 'number');
    expect(y).toHaveLength(2);
    const none = (await sheet('month', false)).getWorksheet('Evolució')!.getRow(5).getCell(1).value;
    expect(String(none)).toMatch(/no hi ha prou dades/i);
  });
});

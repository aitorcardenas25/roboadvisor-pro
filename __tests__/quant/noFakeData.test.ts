// Regressió: l'informe borsari mostrava un "consens d'analistes" generat amb
// Math.random() com si fos real. Ara el mateix input ha de donar el mateix
// informe i no hi ha d'haver cap secció de consens inventat.
import { describe, it, expect } from 'vitest';
import { generateStockReport, type StockReportData } from '@/lib/stockReport';

const data: StockReportData = {
  ticker: 'ITX.MC', name: 'Inditex', description: 'Distribució tèxtil.', sector: 'Consumer Cyclical',
  industry: 'Apparel Retail', website: 'https://www.inditex.com', country: 'Spain',
  price: 48.65, change: 0.42, changePercent: 0.87, currency: 'EUR', exchange: 'BME',
  marketCap: 151e9, volume: 3_250_000, avgVolume: 3_800_000, week52High: 53.1, week52Low: 36.2,
  pe: 23.4, forwardPE: 21.1, eps: 2.08, revenue: 36.1e9, revenueGrowth: 0.076, profitMargin: 0.162,
  roe: 0.283, debtToEquity: 0.12, beta: 0.85, dividendYield: 0.031,
  lastEarningsDate: '2026-09-17', nextEarningsDate: '2026-12-10',
  epsLastQActual: 0.53, epsLastQEstimate: 0.5, epsLastQSurprise: 6, epsLastQDate: '2026-09-17',
  epsNextQEstimate: 0.58, epsNextQDate: '2026-12-10', revenueNextQEst: 9.4e9,
  generatedAt: '6 de novembre de 2026', source: 'partial',
};

describe('informe borsari sense dades inventades', () => {
  it('és determinista per al mateix input', () => {
    expect(generateStockReport(data)).toBe(generateStockReport(data));
  });

  it('no inclou el consens d\'analistes simulat', () => {
    const html = generateStockReport(data);
    expect(html).not.toMatch(/Consens d'analistes/);
    expect(html).not.toMatch(/Cobertures estimades/);
    expect(html).not.toMatch(/Distribució de la recomanació/);
  });
});

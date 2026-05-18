import type { ClientPortfolio, PortfolioMetrics } from './clientPortfolios';
import { computeMetrics } from './clientPortfolios';

export interface MonthlyReportData {
  reportId:        string;
  portfolioId:     string;
  clientName:      string;
  portfolioName:   string;
  generatedAt:     string;
  periodStart:     string;
  periodEnd:       string;
  metrics:         PortfolioMetrics;
  topHoldings:     { name: string; value: number; weight: number; pnlPct: number }[];
  advisorComments: string;
  recommendations: string;
  nextFollowup?:   string;
}

export function generateMonthlyReportData(
  portfolio: ClientPortfolio,
  advisorComments: string,
  periodStart: string,
  periodEnd: string,
): MonthlyReportData {
  const metrics    = computeMetrics(portfolio);
  const totalValue = metrics.currentValue;

  const topHoldings = portfolio.holdings
    .map(h => ({
      name:   h.assetName,
      value:  h.currentPrice * h.quantity,
      weight: totalValue > 0
        ? Math.round((h.currentPrice * h.quantity / totalValue) * 10000) / 100
        : 0,
      pnlPct: h.avgEntryPrice > 0
        ? Math.round(((h.currentPrice - h.avgEntryPrice) / h.avgEntryPrice) * 10000) / 100
        : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    reportId:        `rep-${Date.now()}`,
    portfolioId:     portfolio.id,
    clientName:      portfolio.clientName,
    portfolioName:   portfolio.name,
    generatedAt:     new Date().toISOString(),
    periodStart,
    periodEnd,
    metrics,
    topHoldings,
    advisorComments,
    recommendations: portfolio.recommendations,
    nextFollowup:    portfolio.nextFollowup,
  };
}

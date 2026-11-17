import type { ClientPortfolio, PortfolioMetrics } from './clientPortfolios';
import { computeMetrics } from './clientPortfolios';
import type { NavPoint } from './navMath';
import { navOnOrBefore, navsByIsin, valuationAt, valuationSeries, type ValuationPoint } from './portfolioValuation';
import { computeDrift, reviewStatus, DRIFT_THRESHOLD_PP, type DriftRow, type ReviewStatus } from './portfolioAlerts';

/** Resultat del període calculat amb els valors liquidatius oficials (fund_navs). */
export interface PeriodPerformance {
  start:            string;
  end:              string;
  valueStart:       number;
  valueEnd:         number;
  netFlows:         number;   // aportacions − retirades del període (compres − vendes)
  gain:             number;   // valor final − valor inicial − aportacions netes
  periodReturn:     number;   // %, Modified Dietz (Dietz, 1968)
  investedEnd:      number;   // capital aportat acumulat a la data final
  cumulativeReturn: number;   // %, (valor final − capital aportat) / capital aportat
}

export interface ReportOperation { date: string; type: string; name: string; quantity: number; price: number; amount: number }

export interface MonthlyReportOfficial {
  source:      'navs';
  performance: PeriodPerformance | null;
  note?:       string;                     // per què no hi ha resultat (falten preus…)
  evolution:   ValuationPoint[];           // finals de mes (fins a 12) fins a la data final
  allocation:  { targetVersion: number; threshold: number; rows: DriftRow[] } | null;
  operations:  ReportOperation[];
  review:      ReviewStatus;
}

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
  official?:       MonthlyReportOfficial;   // informes generats abans no en tenen
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
    .filter(h => h.quantity > 0)   // les venudes del tot no
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
    reportId:        globalThis.crypto.randomUUID(),   // UUID traçable (AGENTS.md, Report Engine)
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

const r2 = (n: number) => Math.round(n * 100) / 100;
const TX_LABEL: Record<string, string> = { buy: 'Compra', sell: 'Venda', deposit: 'Aportació', withdrawal: 'Retirada', rebalance: 'Rebalanceig' };

/**
 * Part de l'informe mensual amb dades oficials: resultat del període, evolució,
 * pesos respecte de la proposta, operacions del període i revisions pendents.
 * No s'inventa cap valor: si falta un preu, el resultat queda buit amb el motiu.
 */
export function buildOfficialSection(
  portfolio: ClientPortfolio,
  navs: NavPoint[],
  target: { version: number; items: { isin: string; name: string; weight: number }[] } | null,
  lastApprovedAt: string | undefined,
  periodStart: string,
  periodEnd: string,
): MonthlyReportOfficial {
  const start = periodStart.slice(0, 10), end = periodEnd.slice(0, 10);
  // El valor inicial és el del tancament del dia anterior a l'inici del període.
  const dayBefore = new Date(Date.parse(start) - 86_400_000).toISOString().slice(0, 10);
  const { points: [p0, p1], missing } = valuationAt(portfolio.holdings, portfolio.transactions, navs, [dayBefore, end]);

  let performance: PeriodPerformance | null = null;
  let note: string | undefined;
  if (missing.length) note = `No es pot calcular amb valors liquidatius oficials en EUR. Falten preus de: ${missing.join(', ')}.`;
  else if (!p0 || !p1) note = `Falta el valor liquidatiu oficial d'algun fons a ${!p1 ? end : dayBefore} (o és de fa més de 45 dies). Carrega preus més recents.`;
  else {
    const netFlows = r2(p1.invested - p0.invested);
    const gain = r2(p1.value - p0.value - netFlows);
    const base = p0.value + netFlows / 2;
    performance = {
      start, end, valueStart: p0.value, valueEnd: p1.value, netFlows, gain,
      periodReturn: base > 0 ? r2(gain / base * 100) : 0,
      investedEnd: p1.invested,
      cumulativeReturn: p1.invested > 0 ? r2((p1.value - p1.invested) / p1.invested * 100) : 0,
    };
  }

  const series = valuationSeries(portfolio.holdings, portfolio.transactions, navs, end);
  const evolution = series.points.filter(p => p.date <= end).slice(-13);

  // Pesos a la data final, amb el VL oficial d'aquell dia
  let allocation: MonthlyReportOfficial['allocation'] = null;
  // Participacions a la data final: les actuals menys les compres/vendes posteriors.
  const qtyAtEnd = (id: string, qty: number) => portfolio.transactions
    .filter(t => t.holdingId === id && t.date.slice(0, 10) > end && (t.operationType === 'buy' || t.operationType === 'sell'))
    .reduce((q, t) => q - (t.operationType === 'buy' ? t.quantity : -t.quantity), qty);
  const open = portfolio.holdings.map(h => ({ ...h, quantity: qtyAtEnd(h.id, h.quantity) })).filter(h => h.quantity > 1e-9);
  if (target && open.length && performance) {
    const by = navsByIsin(navs);
    const priceAt = (isin: string) => navOnOrBefore(by.get(isin.toUpperCase()), end)?.nav;
    allocation = {
      targetVersion: target.version, threshold: DRIFT_THRESHOLD_PP,
      rows: computeDrift(open.map(h => ({ ...h, currentPrice: priceAt(h.assetIsin) ?? h.currentPrice })), target.items).rows,
    };
  }

  const operations: ReportOperation[] = portfolio.transactions
    .filter(t => t.date.slice(0, 10) >= start && t.date.slice(0, 10) <= end)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(t => ({ date: t.date.slice(0, 10), type: TX_LABEL[t.operationType] ?? t.operationType, name: t.assetName ?? t.ticker ?? '', quantity: t.quantity, price: t.priceEur, amount: t.totalEur }));

  return {
    source: 'navs', performance, note, evolution, allocation, operations,
    review: reviewStatus({ nextFollowup: portfolio.nextFollowup, lastApprovedAt }, end),
  };
}

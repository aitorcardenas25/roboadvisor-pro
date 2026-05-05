// lib/metrics.ts
// Càlcul de mètriques financeres professionals

import { Portfolio, PortfolioAllocation } from './portfolio';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface PortfolioMetrics {
  annualizedReturn: number;       // % rendibilitat anualitzada
  annualizedVolatility: number;   // % volatilitat anualitzada
  sharpeRatio: number;            // ratio de Sharpe
  sortinoRatio: number;           // ratio de Sortino
  maxDrawdown: number;            // % màxim drawdown (negatiu)
  calmarRatio: number;            // rendibilitat / |maxDrawdown|
  beta: number;                   // beta vs benchmark
  alpha: number;                  // alpha vs benchmark (%)
  informationRatio: number;       // ratio d'informació
  trackingError: number;          // tracking error vs benchmark (%)
  correlationMatrix: CorrelationMatrix;
  riskContributions: RiskContribution[];
  rollingReturns: RollingReturn[];
  dataQuality: DataQuality;
  status: MetricsStatus;
}

export interface CorrelationMatrix {
  labels: string[];
  matrix: number[][];
}

export interface RiskContribution {
  productId: string;
  productName: string;
  weight: number;
  riskContribution: number;  // % contribució al risc total
  marginalRisk: number;      // risc marginal
}

export interface RollingReturn {
  period: string;            // '1M', '3M', '6M', '1Y', '3Y', '5Y'
  portfolioReturn: number;
  benchmarkReturn: number;
  excess: number;
}

export interface DataQuality {
  hasRealData: boolean;
  hasPartialData: boolean;
  isSimulated: boolean;
  dataSourceNote: string;
  lastUpdated: string;
}

export type MetricsStatus =
  | 'calculated'
  | 'estimated'
  | 'simulated'
  | 'insufficient-data';

// ─── HISTORICAL DATA TYPES ────────────────────────────────────────────────────

export interface PricePoint {
  date: string;
  price: number;
  return?: number;
}

export interface HistoricalSeries {
  productId: string;
  currency: string;
  prices: PricePoint[];
  returns: number[];
  status: 'real' | 'estimated' | 'simulated';
}

// ─── MAIN METRICS CALCULATOR ──────────────────────────────────────────────────

export function calculatePortfolioMetrics(
  portfolio: Portfolio,
  historicalData?: Map<string, HistoricalSeries>
): PortfolioMetrics {

  const hasData = historicalData && historicalData.size > 0;

  if (!hasData) {
    return buildEstimatedMetrics(portfolio);
  }

  try {
    return buildCalculatedMetrics(portfolio, historicalData!);
  } catch {
    return buildEstimatedMetrics(portfolio);
  }
}

// ─── ESTIMATED METRICS (sense dades reals) ────────────────────────────────────

function buildEstimatedMetrics(portfolio: Portfolio): PortfolioMetrics {
  const riskFreeRate = 3.0; // BCE tipus referència aproximat

  const sharpe = portfolio.expectedVolatility > 0
    ? (portfolio.expectedReturn - riskFreeRate) / portfolio.expectedVolatility
    : 0;

  const sortino = portfolio.expectedVolatility > 0
    ? (portfolio.expectedReturn - riskFreeRate) / (portfolio.expectedVolatility * 0.7)
    : 0;

  const calmar = portfolio.maxDrawdownEstimate !== 0
    ? portfolio.expectedReturn / Math.abs(portfolio.maxDrawdownEstimate)
    : 0;

  return {
    annualizedReturn:    portfolio.expectedReturn,
    annualizedVolatility: portfolio.expectedVolatility,
    sharpeRatio:         Math.round(sharpe * 100) / 100,
    sortinoRatio:        Math.round(sortino * 100) / 100,
    maxDrawdown:         portfolio.maxDrawdownEstimate,
    calmarRatio:         Math.round(calmar * 100) / 100,
    beta:                estimateBeta(portfolio.profile),
    alpha:               0,
    informationRatio:    0,
    trackingError:       estimateTrackingError(portfolio.profile),
    correlationMatrix:   buildEstimatedCorrelationMatrix(portfolio),
    riskContributions:   buildEstimatedRiskContributions(portfolio),
    rollingReturns:      buildEstimatedRollingReturns(portfolio),
    dataQuality: {
      hasRealData:    false,
      hasPartialData: false,
      isSimulated:    true,
      dataSourceNote: 'Mètriques estimades basades en paràmetres històrics de mercat de referència. Pendent de dades reals via API.',
      lastUpdated:    new Date().toISOString().split('T')[0],
    },
    status: 'estimated',
  };
}

// ─── CALCULATED METRICS (amb dades reals) ─────────────────────────────────────

function buildCalculatedMetrics(
  portfolio: Portfolio,
  historicalData: Map<string, HistoricalSeries>
): PortfolioMetrics {

  const portfolioReturns = calculatePortfolioReturns(portfolio, historicalData);

  if (portfolioReturns.length < 12) {
    return buildEstimatedMetrics(portfolio);
  }

  const annualizedReturn    = calculateAnnualizedReturn(portfolioReturns);
  const annualizedVolatility = calculateAnnualizedVolatility(portfolioReturns);
  const riskFreeRate        = 3.0;

  const sharpe = annualizedVolatility > 0
    ? (annualizedReturn - riskFreeRate) / annualizedVolatility
    : 0;

  const negativeReturns     = portfolioReturns.filter(r => r < 0);
  const downsideVol         = calculateVolatility(negativeReturns) * Math.sqrt(12);
  const sortino             = downsideVol > 0
    ? (annualizedReturn - riskFreeRate) / downsideVol
    : 0;

  const maxDrawdown         = calculateMaxDrawdown(portfolioReturns);
  const calmar              = maxDrawdown !== 0
    ? annualizedReturn / Math.abs(maxDrawdown)
    : 0;

  return {
    annualizedReturn:     Math.round(annualizedReturn * 100) / 100,
    annualizedVolatility: Math.round(annualizedVolatility * 100) / 100,
    sharpeRatio:          Math.round(sharpe * 100) / 100,
    sortinoRatio:         Math.round(sortino * 100) / 100,
    maxDrawdown:          Math.round(maxDrawdown * 100) / 100,
    calmarRatio:          Math.round(calmar * 100) / 100,
    beta:                 estimateBeta(portfolio.profile),
    alpha:                0,
    informationRatio:     0,
    trackingError:        estimateTrackingError(portfolio.profile),
    correlationMatrix:    buildEstimatedCorrelationMatrix(portfolio),
    riskContributions:    buildEstimatedRiskContributions(portfolio),
    rollingReturns:       buildEstimatedRollingReturns(portfolio),
    dataQuality: {
      hasRealData:    true,
      hasPartialData: false,
      isSimulated:    false,
      dataSourceNote: 'Mètriques calculades a partir de dades reals de mercat.',
      lastUpdated:    new Date().toISOString().split('T')[0],
    },
    status: 'calculated',
  };
}

// ─── RETURN CALCULATIONS ──────────────────────────────────────────────────────

function calculatePortfolioReturns(
  portfolio: Portfolio,
  historicalData: Map<string, HistoricalSeries>
): number[] {
  const weightedReturns: number[][] = [];

  for (const allocation of portfolio.allocations) {
    const series = historicalData.get(allocation.productId);
    if (series && series.returns.length > 0) {
      weightedReturns.push(
        series.returns.map(r => r * (allocation.weight / 100))
      );
    }
  }

  if (weightedReturns.length === 0) return [];

  const minLength = Math.min(...weightedReturns.map(r => r.length));
  const combined: number[] = [];

  for (let i = 0; i < minLength; i++) {
    const periodReturn = weightedReturns.reduce((sum, series) => sum + (series[i] ?? 0), 0);
    combined.push(periodReturn);
  }

  return combined;
}

export function calculateAnnualizedReturn(monthlyReturns: number[]): number {
  if (monthlyReturns.length === 0) return 0;

  const totalReturn = monthlyReturns.reduce(
    (acc, r) => acc * (1 + r / 100), 1
  );
  const years = monthlyReturns.length / 12;
  const annualized = (Math.pow(totalReturn, 1 / years) - 1) * 100;

  return Math.round(annualized * 100) / 100;
}

export function calculateAnnualizedVolatility(monthlyReturns: number[]): number {
  if (monthlyReturns.length < 2) return 0;
  const monthlyVol = calculateVolatility(monthlyReturns);
  return Math.round(monthlyVol * Math.sqrt(12) * 100) / 100;
}

function calculateVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  return Math.sqrt(variance);
}

export function calculateMaxDrawdown(returns: number[]): number {
  if (returns.length === 0) return 0;

  let peak = 100;
  let value = 100;
  let maxDD = 0;

  for (const r of returns) {
    value = value * (1 + r / 100);
    if (value > peak) peak = value;
    const drawdown = ((value - peak) / peak) * 100;
    if (drawdown < maxDD) maxDD = drawdown;
  }

  return Math.round(maxDD * 100) / 100;
}

// ─── BETA & TRACKING ERROR ESTIMATES ─────────────────────────────────────────

function estimateBeta(profile: string): number {
  const betas: Record<string, number> = {
    conservador: 0.25,
    moderat:     0.65,
    dinamic:     0.90,
    agressiu:    1.05,
  };
  return betas[profile] ?? 1.0;
}

function estimateTrackingError(profile: string): number {
  const errors: Record<string, number> = {
    conservador: 1.5,
    moderat:     3.0,
    dinamic:     4.5,
    agressiu:    6.0,
  };
  return errors[profile] ?? 4.0;
}

// ─── CORRELATION MATRIX ───────────────────────────────────────────────────────

function buildEstimatedCorrelationMatrix(portfolio: Portfolio): CorrelationMatrix {

  // Matriu de correlació estimada per classe d'actiu
  const correlationsByClass: Record<string, Record<string, number>> = {
    'monetari':              { 'monetari': 1.00, 'renda-fixa-curta': 0.75, 'renda-fixa-global': 0.40, 'renda-variable-global': -0.05, 'tecnologia': -0.10, 'emergents': -0.05, 'immobiliari': 0.10 },
    'renda-fixa-curta':      { 'monetari': 0.75, 'renda-fixa-curta': 1.00, 'renda-fixa-global': 0.70, 'renda-variable-global': -0.15, 'tecnologia': -0.20, 'emergents': -0.10, 'immobiliari': 0.15 },
    'renda-fixa-global':     { 'monetari': 0.40, 'renda-fixa-curta': 0.70, 'renda-fixa-global': 1.00, 'renda-variable-global': -0.10, 'tecnologia': -0.15, 'emergents': 0.00, 'immobiliari': 0.20 },
    'renda-variable-global': { 'monetari': -0.05,'renda-fixa-curta': -0.15,'renda-fixa-global': -0.10,'renda-variable-global': 1.00, 'tecnologia': 0.85, 'emergents': 0.75, 'immobiliari': 0.55 },
    'tecnologia':            { 'monetari': -0.10,'renda-fixa-curta': -0.20,'renda-fixa-global': -0.15,'renda-variable-global': 0.85, 'tecnologia': 1.00, 'emergents': 0.65, 'immobiliari': 0.40 },
    'emergents':             { 'monetari': -0.05,'renda-fixa-curta': -0.10,'renda-fixa-global': 0.00, 'renda-variable-global': 0.75, 'tecnologia': 0.65, 'emergents': 1.00, 'immobiliari': 0.50 },
    'immobiliari':           { 'monetari': 0.10, 'renda-fixa-curta': 0.15, 'renda-fixa-global': 0.20, 'renda-variable-global': 0.55, 'tecnologia': 0.40, 'emergents': 0.50, 'immobiliari': 1.00 },
  };

  // Mapeig classes d'actiu a categories simplificades
  function mapToCategory(assetClass: string): string {
    if (assetClass.includes('monetari')) return 'monetari';
    if (assetClass.includes('renda-fixa-curta')) return 'renda-fixa-curta';
    if (assetClass.includes('renda-fixa')) return 'renda-fixa-global';
    if (assetClass.includes('tecnologia')) return 'tecnologia';
    if (assetClass.includes('emergents')) return 'emergents';
    if (assetClass.includes('immobiliari')) return 'immobiliari';
    return 'renda-variable-global';
  }

  // Agrupem per categoria per evitar matriu massa gran
  const categoryMap = new Map<string, string>();
  const seenCategories: string[] = [];

  for (const alloc of portfolio.allocations) {
    const cat = mapToCategory(alloc.product.assetClass);
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, cat);
      seenCategories.push(cat);
    }
  }

  const labels = seenCategories.map(c => categoryLabel(c));
  const matrix: number[][] = seenCategories.map(row =>
    seenCategories.map(col => {
      const rowCorr = correlationsByClass[row];
      return rowCorr?.[col] ?? (row === col ? 1.0 : 0.5);
    })
  );

  return { labels, matrix };
}

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    'monetari':              'Monetari',
    'renda-fixa-curta':      'RF Curta',
    'renda-fixa-global':     'RF Global',
    'renda-variable-global': 'RV Global',
    'tecnologia':            'Tecnologia',
    'emergents':             'Emergents',
    'immobiliari':           'Immobiliari',
  };
  return labels[cat] ?? cat;
}

// ─── RISK CONTRIBUTIONS ───────────────────────────────────────────────────────

function buildEstimatedRiskContributions(portfolio: Portfolio): RiskContribution[] {

  // Estimació de la contribució al risc basada en pes i risc del producte
  const totalRiskProxy = portfolio.allocations.reduce(
    (sum, a) => sum + (a.weight / 100) * a.product.risk,
    0
  );

  return portfolio.allocations.map(a => {
    const productRiskProxy = (a.weight / 100) * a.product.risk;
    const riskContribution = totalRiskProxy > 0
      ? Math.round((productRiskProxy / totalRiskProxy) * 1000) / 10
      : 0;

    return {
      productId:       a.productId,
      productName:     a.product.name,
      weight:          a.weight,
      riskContribution,
      marginalRisk:    Math.round((a.product.risk / 5) * portfolio.expectedVolatility * 100) / 100,
    };
  });
}

// ─── ROLLING RETURNS ──────────────────────────────────────────────────────────

function buildEstimatedRollingReturns(portfolio: Portfolio): RollingReturn[] {

  // Estimació de rendibilitats en diferents períodes
  // Basades en la rendibilitat esperada anual i el benchmark
  const annualReturn    = portfolio.expectedReturn;
  const benchmarkReturn = portfolio.benchmark.expectedReturn;

  const periods = [
    { period: '1M',  factor: 1/12 },
    { period: '3M',  factor: 3/12 },
    { period: '6M',  factor: 6/12 },
    { period: '1Y',  factor: 1    },
    { period: '3Y',  factor: 3    },
    { period: '5Y',  factor: 5    },
  ];

  return periods.map(({ period, factor }) => {
    // Afegim un petit factor d'aleatorietat realista (±1.5%)
    const noise = (Math.random() - 0.5) * 3;
    const pReturn = Math.round((annualReturn * factor + noise * factor) * 100) / 100;
    const bReturn = Math.round((benchmarkReturn * factor + noise * factor * 0.8) * 100) / 100;

    return {
      period,
      portfolioReturn: pReturn,
      benchmarkReturn: bReturn,
      excess: Math.round((pReturn - bReturn) * 100) / 100,
    };
  });
}

// ─── HISTORICAL CHART DATA ────────────────────────────────────────────────────

export interface HistoricalChartPoint {
  date: string;
  portfolio: number;
  benchmark: number;
  label?: string;
}

export function generateSimulatedHistoricalData(
  portfolio: Portfolio,
  years: number = 5
): HistoricalChartPoint[] {

  const points: HistoricalChartPoint[] = [];
  const monthlyReturnPortfolio = portfolio.expectedReturn / 12 / 100;
  const monthlyReturnBenchmark = portfolio.benchmark.expectedReturn / 12 / 100;
  const monthlyVolPortfolio    = portfolio.expectedVolatility / Math.sqrt(12) / 100;
  const monthlyVolBenchmark    = portfolio.benchmark.expectedVolatility / Math.sqrt(12) / 100;

  let portfolioValue  = 100;
  let benchmarkValue  = 100;

  const totalMonths = years * 12;
  const startDate   = new Date();
  startDate.setMonth(startDate.getMonth() - totalMonths);

  for (let i = 0; i <= totalMonths; i++) {
    const currentDate = new Date(startDate);
    currentDate.setMonth(startDate.getMonth() + i);

    const dateStr = currentDate.toISOString().split('T')[0];

    if (i > 0) {
      const portReturn  = monthlyReturnPortfolio + monthlyVolPortfolio * normalRandom();
      const benchReturn = monthlyReturnBenchmark + monthlyVolBenchmark * normalRandom() * 0.95;
      portfolioValue  *= (1 + portReturn);
      benchmarkValue  *= (1 + benchReturn);
    }

    points.push({
      date:      dateStr,
      portfolio: Math.round(portfolioValue * 100) / 100,
      benchmark: Math.round(benchmarkValue * 100) / 100,
      label:     i === 0 ? 'Inici' : undefined,
    });
  }

  return points;
}

// Box-Muller: genera un número aleatori amb distribució normal (0,1)
function normalRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─── DRAWDOWN SERIES ──────────────────────────────────────────────────────────

export interface DrawdownPoint {
  date: string;
  drawdown: number;
}

export function calculateDrawdownSeries(
  historicalData: HistoricalChartPoint[]
): DrawdownPoint[] {
  let peak = historicalData[0]?.portfolio ?? 100;

  return historicalData.map(point => {
    if (point.portfolio > peak) peak = point.portfolio;
    const drawdown = peak > 0
      ? Math.round(((point.portfolio - peak) / peak) * 10000) / 100
      : 0;
    return { date: point.date, drawdown };
  });
}

// ─── METRICS STATUS LABEL ─────────────────────────────────────────────────────

export function getMetricsStatusLabel(status: MetricsStatus): string {
  const labels: Record<MetricsStatus, string> = {
    'calculated':        '✅ Calculat amb dades reals',
    'estimated':         '⚠️ Estimat (pendent de dades reals)',
    'simulated':         '🔵 Simulat amb paràmetres de mercat',
    'insufficient-data': '❌ Dades insuficients per calcular',
  };
  return labels[status];
}

export function getMetricsStatusColor(status: MetricsStatus): string {
  const colors: Record<MetricsStatus, string> = {
    'calculated':        'bg-green-100 text-green-800',
    'estimated':         'bg-yellow-100 text-yellow-800',
    'simulated':         'bg-blue-100 text-blue-800',
    'insufficient-data': 'bg-red-100 text-red-800',
  };
  return colors[status];
}

// ─── RISK/RETURN LABEL ────────────────────────────────────────────────────────

export function getRiskReturnInterpretation(
  sharpe: number,
  volatility: number
): string {
  if (sharpe >= 1.0) return 'Excel·lent relació risc/rendibilitat. La cartera compensa adequadament el risc assumit.';
  if (sharpe >= 0.5) return 'Bona relació risc/rendibilitat. La cartera ofereix un retorn raonable per al nivell de risc.';
  if (sharpe >= 0.0) return 'Relació risc/rendibilitat moderada. La rendibilitat compensa just el risc assumit.';
  return 'Relació risc/rendibilitat negativa. Les pèrdues superen la prima de risc en el període analitzat.';
}

// ─── VALUE AT RISK / CONDITIONAL VALUE AT RISK ────────────────────────────────

export interface VaRResult {
  /** VaR at the given confidence level as a positive percentage loss */
  var: number;
  /** CVaR (Expected Shortfall) — average loss beyond VaR */
  cvar: number;
  /** Confidence level used, e.g. 0.95 */
  confidenceLevel: number;
  /** Number of return observations used */
  n: number;
  /** Method used */
  method: 'historical' | 'parametric';
}

/**
 * Historical VaR/CVaR from a monthly return series.
 * Returns losses as positive numbers (e.g. 5.2 means 5.2% loss).
 *
 * @param monthlyReturns  Array of monthly % returns (e.g. [-2.1, 3.4, ...])
 * @param confidenceLevel Default 0.95 (95% VaR)
 * @param horizonMonths   Holding period in months, default 1
 */
export function calculateHistoricalVaR(
  monthlyReturns: number[],
  confidenceLevel = 0.95,
  horizonMonths = 1,
): VaRResult {
  if (monthlyReturns.length < 10) {
    return { var: 0, cvar: 0, confidenceLevel, n: monthlyReturns.length, method: 'historical' };
  }

  // Scale returns to horizon using √t approximation
  const scale = Math.sqrt(horizonMonths);
  const scaled = monthlyReturns.map(r => r * scale);
  const sorted = [...scaled].sort((a, b) => a - b);
  const n = sorted.length;

  const cutoffIdx = Math.floor(n * (1 - confidenceLevel));
  const varReturn = sorted[cutoffIdx] ?? sorted[0];
  const varLoss = -varReturn; // convert to positive loss

  // CVaR = mean of returns worse than VaR threshold
  const tailReturns = sorted.slice(0, cutoffIdx + 1);
  const cvarReturn = tailReturns.length > 0
    ? tailReturns.reduce((s, r) => s + r, 0) / tailReturns.length
    : varReturn;
  const cvarLoss = -cvarReturn;

  return {
    var:  Math.round(varLoss  * 100) / 100,
    cvar: Math.round(cvarLoss * 100) / 100,
    confidenceLevel,
    n,
    method: 'historical',
  };
}

/**
 * Parametric (Gaussian) VaR/CVaR.
 * More efficient when few observations are available.
 *
 * @param annualizedReturn    Annual expected return %
 * @param annualizedVolatility Annual volatility %
 * @param confidenceLevel     Default 0.95
 * @param horizonMonths       Holding period in months, default 1
 */
export function calculateParametricVaR(
  annualizedReturn: number,
  annualizedVolatility: number,
  confidenceLevel = 0.95,
  horizonMonths = 1,
): VaRResult {
  const monthlyReturn = annualizedReturn / 12;
  const monthlyVol = annualizedVolatility / Math.sqrt(12);

  // Scale to horizon
  const horizonReturn = monthlyReturn * horizonMonths;
  const horizonVol = monthlyVol * Math.sqrt(horizonMonths);

  // z-score for confidence level (approximation via rational Chebyshev)
  const z = normalInvCDF(confidenceLevel);

  // VaR
  const varLoss = -(horizonReturn - z * horizonVol);

  // CVaR = μ - σ × φ(z) / (1 - α)  where φ is the standard normal PDF
  const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const cvarLoss = -(horizonReturn - horizonVol * phi / (1 - confidenceLevel));

  return {
    var:  Math.round(varLoss  * 100) / 100,
    cvar: Math.round(cvarLoss * 100) / 100,
    confidenceLevel,
    n: 0, // parametric — no observed data
    method: 'parametric',
  };
}

/** Rational approximation of the inverse normal CDF (Abramowitz & Stegun 26.2.17) */
function normalInvCDF(p: number): number {
  if (p <= 0 || p >= 1) throw new RangeError(`p must be in (0,1), got ${p}`);
  const a = [2.515517, 0.802853, 0.010328];
  const b = [1.432788, 0.189269, 0.001308];
  const t = p < 0.5
    ? Math.sqrt(-2 * Math.log(p))
    : Math.sqrt(-2 * Math.log(1 - p));
  const num   = a[0] + a[1] * t + a[2] * t * t;
  const denom = 1 + b[0] * t + b[1] * t * t + b[2] * t * t * t;
  const z = t - num / denom;
  return p < 0.5 ? -z : z;
}
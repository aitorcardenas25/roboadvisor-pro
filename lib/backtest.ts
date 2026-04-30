// lib/backtest.ts
// Motor de backtesting per al RoboAdvisor Pro
// Implementa anàlisi de rendibilitat històrica, atribució de rendiment i risk analytics

import { Portfolio, PortfolioAllocation } from './portfolio';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface BacktestConfig {
  startDate:         string;       // YYYY-MM-DD
  endDate:           string;       // YYYY-MM-DD
  initialAmount:     number;       // capital inicial en EUR
  monthlyContribution?: number;    // aportació mensual (opcional)
  riskFreeRate?:     number;       // tipus lliure de risc (default 3.0%)
  inflationRate?:    number;       // inflació (default 2.5%)
  benchmarkReturn?:  number;       // rendibilitat anual benchmark (default 8.0%)
  benchmarkVol?:     number;       // volatilitat benchmark (default 15.0%)
}

export interface BacktestResult {
  config:            BacktestConfig;
  portfolioSeries:   BacktestPoint[];
  benchmarkSeries:   BacktestPoint[];
  contributionSeries: BacktestPoint[];
  drawdownSeries:    BacktestPoint[];
  metrics:           BacktestMetrics;
  yearlyAnalysis:    YearlyAnalysis[];
  attribution:       PerformanceAttribution;
  riskAnalysis:      RiskAnalysis;
  dataQuality:       BacktestDataQuality;
}

export interface BacktestPoint {
  date:   string;
  value:  number;
  return?: number;  // rendibilitat mensual %
}

export interface BacktestMetrics {
  // Rendibilitat
  totalReturn:          number;    // % rendibilitat total acumulada
  annualizedReturn:     number;    // % rendibilitat anualitzada (CAGR)
  benchmarkTotalReturn: number;
  benchmarkAnnualized:  number;
  excessReturn:         number;    // alpha vs benchmark (pp)

  // Risc
  annualizedVolatility: number;    // % desviació estàndard anualitzada
  benchmarkVolatility:  number;
  maxDrawdown:          number;    // % màxim drawdown (negatiu)
  maxDrawdownDuration:  number;    // mesos de recuperació
  averageDrawdown:      number;    // % drawdown mig

  // Ràtios ajustats per risc
  sharpeRatio:          number;
  sortinoRatio:         number;
  calmarRatio:          number;    // CAGR / |MaxDD|
  informationRatio:     number;    // excess return / tracking error
  treynorRatio:         number;    // (R - Rf) / Beta
  beta:                 number;
  alpha:                number;    // alpha de Jensen anualitzat
  trackingError:        number;    // % desv. estàndard de l'excess return

  // Valor
  initialValue:         number;
  finalValue:           number;
  totalContributions:   number;
  totalGain:            number;    // guany net (excloent contribucions)
  finalValueReal:       number;    // valor final ajustat per inflació

  // Winning/losing
  winningMonths:        number;    // % mesos positius
  averageWin:           number;    // % retorn mig en mesos positius
  averageLoss:          number;    // % retorn mig en mesos negatius
  bestMonth:            number;
  worstMonth:           number;
}

export interface YearlyAnalysis {
  year:                 number;
  portfolioReturn:      number;   // % rendibilitat anual
  benchmarkReturn:      number;
  excess:               number;   // alpha anual
  volatility:           number;
  maxDrawdown:          number;
  startValue:           number;
  endValue:             number;
}

export interface PerformanceAttribution {
  byAssetClass:         AttributionItem[];
  byGeography:          AttributionItem[];
  byManagementStyle:    AttributionItem[];
  totalAllocationEffect: number;
  totalSelectionEffect:  number;
  totalInteractionEffect: number;
}

export interface AttributionItem {
  label:                string;
  portfolioWeight:      number;
  benchmarkWeight:      number;
  portfolioReturn:      number;
  benchmarkReturn:      number;
  allocationEffect:     number;
  selectionEffect:      number;
  totalContribution:    number;
}

export interface RiskAnalysis {
  var95:                number;    // Value at Risk 95% mensual
  var99:                number;    // Value at Risk 99% mensual
  cvar95:               number;    // Conditional VaR 95% (Expected Shortfall)
  downsideDeviation:    number;    // desv. estàndard dels retorns negatius
  uptureCapture:        number;    // % captura de mercats alcistes
  downtureCapture:      number;    // % captura de mercats baixistes
  correlationToBenchmark: number;
  skewness:             number;    // asimetria de la distribució de retorns
  kurtosis:             number;    // curtosi de la distribució de retorns
}

export interface BacktestDataQuality {
  source:               'real' | 'simulated' | 'mixed';
  productsWithRealData: number;
  productsSimulated:    number;
  dataCompleteness:     number;    // % de punts amb dades reals (0-100)
  note:                 string;
  warnings:             string[];
}

// ─── ESTIMATED PARAMETERS PER ASSET CLASS ─────────────────────────────────────

const ASSET_CLASS_PARAMS: Record<string, { return: number; vol: number }> = {
  'monetari':              { return: 3.0,  vol: 0.5  },
  'renda-fixa-curta':      { return: 2.5,  vol: 2.0  },
  'renda-fixa-global':     { return: 3.5,  vol: 5.5  },
  'renda-fixa-europa':     { return: 4.0,  vol: 6.0  },
  'renda-variable-global': { return: 8.5,  vol: 15.0 },
  'renda-variable-usa':    { return: 10.0, vol: 16.0 },
  'renda-variable-europa': { return: 7.5,  vol: 15.5 },
  'renda-variable-espanya':{ return: 7.0,  vol: 17.0 },
  'renda-variable-emergents':{ return: 9.5, vol: 20.0 },
  'small-caps-global':     { return: 10.5, vol: 18.0 },
  'small-caps-europa':     { return: 9.5,  vol: 18.5 },
  'tecnologia':            { return: 13.0, vol: 22.0 },
  'energia':               { return: 7.0,  vol: 25.0 },
  'salut-biotech':         { return: 8.5,  vol: 14.0 },
  'dividends-income':      { return: 6.5,  vol: 11.0 },
  'esg':                   { return: 7.5,  vol: 13.5 },
  'immobiliari-reits':     { return: 6.5,  vol: 15.0 },
};

// ─── MAIN BACKTEST ENGINE ──────────────────────────────────────────────────────

export function runBacktest(
  portfolio:         Portfolio,
  config:            BacktestConfig,
  historicalData?:   Map<string, number[]>  // productId -> monthly returns %
): BacktestResult {

  const {
    startDate,
    endDate,
    initialAmount,
    monthlyContribution = 0,
    riskFreeRate        = 3.0,
    inflationRate       = 2.5,
    benchmarkReturn     = portfolio.benchmark.expectedReturn,
    benchmarkVol        = portfolio.benchmark.expectedVolatility,
  } = config;

  const months = monthsBetween(startDate, endDate);
  if (months <= 0) {
    return buildEmptyResult(config);
  }

  // ── Generar retorns mensuals per cada producte ────────────────────────────
  const productReturns = new Map<string, number[]>();
  let productsSimulated = 0;
  let productsWithData  = 0;

  for (const alloc of portfolio.allocations) {
    const realData = historicalData?.get(alloc.productId);
    if (realData && realData.length >= months * 0.5) {
      productReturns.set(alloc.productId, padOrTrimReturns(realData, months));
      productsWithData++;
    } else {
      const params = ASSET_CLASS_PARAMS[alloc.product.assetClass] ??
                     { return: alloc.product.risk * 1.5, vol: alloc.product.risk * 3.5 };
      productReturns.set(alloc.productId, simulateMonthlyReturns(params.return, params.vol, months, alloc.productId));
      productsSimulated++;
    }
  }

  // ── Construir sèrie de retorns mensuals de la cartera ─────────────────────
  const portfolioMonthlyReturns = buildPortfolioReturns(
    portfolio.allocations,
    productReturns,
    months
  );

  // ── Construir sèrie de retorns del benchmark ──────────────────────────────
  const benchmarkMonthlyReturns = simulateMonthlyReturns(
    benchmarkReturn, benchmarkVol, months, 'benchmark'
  );

  // ── Construir sèries de valors ────────────────────────────────────────────
  const portfolioSeries   = buildValueSeries(portfolioMonthlyReturns, initialAmount, monthlyContribution, startDate);
  const benchmarkSeries   = buildValueSeries(benchmarkMonthlyReturns, initialAmount, 0, startDate);
  const contributionSeries = buildContributionSeries(initialAmount, monthlyContribution, months, startDate);
  const drawdownSeries    = buildDrawdownSeries(portfolioSeries);

  // ── Calcular mètriques ────────────────────────────────────────────────────
  const metrics = calculateMetrics(
    portfolioSeries,
    benchmarkSeries,
    portfolioMonthlyReturns,
    benchmarkMonthlyReturns,
    initialAmount,
    monthlyContribution,
    months,
    riskFreeRate,
    inflationRate
  );

  // ── Anàlisi per anys ──────────────────────────────────────────────────────
  const yearlyAnalysis = buildYearlyAnalysis(
    portfolioSeries,
    benchmarkSeries,
    portfolioMonthlyReturns,
    benchmarkMonthlyReturns,
    startDate
  );

  // ── Atribució de rendiment ────────────────────────────────────────────────
  const attribution = buildAttribution(portfolio, productReturns, months);

  // ── Anàlisi de risc avançat ───────────────────────────────────────────────
  const riskAnalysis = buildRiskAnalysis(portfolioMonthlyReturns, benchmarkMonthlyReturns);

  // ── Qualitat de dades ─────────────────────────────────────────────────────
  const dataQuality: BacktestDataQuality = {
    source: productsSimulated === 0 ? 'real'
          : productsWithData  === 0 ? 'simulated'
          : 'mixed',
    productsWithRealData: productsWithData,
    productsSimulated,
    dataCompleteness: Math.round(
      (productsWithData / portfolio.allocations.length) * 100
    ),
    note: productsSimulated === 0
      ? '✅ Backtest calculat amb dades reals de mercat.'
      : productsWithData  === 0
      ? '⚠️ Totes les dades són simulades. Configura les API keys per a dades reals.'
      : `⚠️ ${productsSimulated} de ${portfolio.allocations.length} productes utilitzen dades simulades.`,
    warnings: buildDataWarnings(months, productsSimulated, portfolio.allocations.length),
  };

  return {
    config,
    portfolioSeries,
    benchmarkSeries,
    contributionSeries,
    drawdownSeries,
    metrics,
    yearlyAnalysis,
    attribution,
    riskAnalysis,
    dataQuality,
  };
}

// ─── PORTFOLIO RETURNS ─────────────────────────────────────────────────────────

function buildPortfolioReturns(
  allocations:   PortfolioAllocation[],
  productReturns: Map<string, number[]>,
  months:        number
): number[] {
  const combined: number[] = new Array(months).fill(0);

  for (const alloc of allocations) {
    const returns = productReturns.get(alloc.productId) ?? new Array(months).fill(0);
    for (let i = 0; i < months; i++) {
      combined[i] += (returns[i] ?? 0) * (alloc.weight / 100);
    }
  }

  return combined;
}

// ─── VALUE SERIES ──────────────────────────────────────────────────────────────

function buildValueSeries(
  monthlyReturns:      number[],
  initialAmount:       number,
  monthlyContribution: number,
  startDate:           string
): BacktestPoint[] {
  const series: BacktestPoint[] = [];
  let value = initialAmount;
  const start = new Date(startDate);

  series.push({ date: formatDate(start), value: Math.round(value * 100) / 100 });

  for (let i = 0; i < monthlyReturns.length; i++) {
    const r   = monthlyReturns[i] ?? 0;
    value     = value * (1 + r / 100) + monthlyContribution;
    value     = Math.max(0, value);

    const d   = new Date(start);
    d.setMonth(start.getMonth() + i + 1);

    series.push({
      date:   formatDate(d),
      value:  Math.round(value * 100) / 100,
      return: Math.round(r * 100) / 100,
    });
  }

  return series;
}

function buildContributionSeries(
  initialAmount:       number,
  monthlyContribution: number,
  months:              number,
  startDate:           string
): BacktestPoint[] {
  const series: BacktestPoint[] = [];
  const start = new Date(startDate);
  let cumContrib = initialAmount;

  series.push({ date: formatDate(start), value: cumContrib });

  for (let i = 0; i < months; i++) {
    cumContrib += monthlyContribution;
    const d = new Date(start);
    d.setMonth(start.getMonth() + i + 1);
    series.push({ date: formatDate(d), value: Math.round(cumContrib) });
  }

  return series;
}

function buildDrawdownSeries(portfolioSeries: BacktestPoint[]): BacktestPoint[] {
  let peak = portfolioSeries[0]?.value ?? 1;

  return portfolioSeries.map(point => {
    if (point.value > peak) peak = point.value;
    const dd = peak > 0 ? ((point.value - peak) / peak) * 100 : 0;
    return { date: point.date, value: Math.round(dd * 100) / 100 };
  });
}

// ─── METRICS ──────────────────────────────────────────────────────────────────

function calculateMetrics(
  portfolioSeries:    BacktestPoint[],
  benchmarkSeries:    BacktestPoint[],
  portfolioReturns:   number[],
  benchmarkReturns:   number[],
  initialAmount:      number,
  monthlyContribution: number,
  months:             number,
  riskFreeRate:       number,
  inflationRate:      number
): BacktestMetrics {

  const finalValue      = portfolioSeries.at(-1)?.value ?? initialAmount;
  const benchmarkFinal  = benchmarkSeries.at(-1)?.value ?? initialAmount;
  const totalContribs   = initialAmount + monthlyContribution * months;
  const totalGain       = finalValue - totalContribs;

  const years           = months / 12;

  // CAGR (compound annual growth rate)
  const cagr            = years > 0 ? (Math.pow(finalValue / initialAmount, 1 / years) - 1) * 100 : 0;
  const benchmarkCAGR   = years > 0 ? (Math.pow(benchmarkFinal / initialAmount, 1 / years) - 1) * 100 : 0;

  const totalReturn     = initialAmount > 0 ? ((finalValue - initialAmount) / initialAmount) * 100 : 0;
  const benchmarkTotal  = initialAmount > 0 ? ((benchmarkFinal - initialAmount) / initialAmount) * 100 : 0;

  // Volatilitat
  const portVol         = annualizeVolatility(portfolioReturns);
  const benchVol        = annualizeVolatility(benchmarkReturns);

  // Max Drawdown
  const { maxDD, maxDDDuration } = calculateMaxDrawdownAdvanced(portfolioReturns);
  const avgDD           = calculateAverageDrawdown(portfolioReturns);

  // Ràtios
  const rfMonthly       = riskFreeRate / 12;
  const excessReturns   = portfolioReturns.map((r, i) => r - (benchmarkReturns[i] ?? 0));
  const trackingError   = annualizeVolatility(excessReturns);

  const sharpe          = portVol > 0 ? (cagr - riskFreeRate) / portVol : 0;
  const negReturns      = portfolioReturns.filter(r => r < rfMonthly);
  const downsideDev     = annualizeVolatility(negReturns.length > 1 ? negReturns : [0]);
  const sortino         = downsideDev > 0 ? (cagr - riskFreeRate) / downsideDev : 0;
  const calmar          = maxDD !== 0 ? cagr / Math.abs(maxDD) : 0;
  const infoRatio       = trackingError > 0 ? (cagr - benchmarkCAGR) / trackingError : 0;

  // Beta i Alpha (regressió lineal simplificada)
  const { beta, alpha: alphaRaw } = calculateBetaAlpha(portfolioReturns, benchmarkReturns);
  const alphaAnnualized = alphaRaw * 12;
  const treynor         = beta !== 0 ? (cagr - riskFreeRate) / beta : 0;

  // Winning months
  const positiveMonths  = portfolioReturns.filter(r => r > 0).length;
  const negativeMonths  = portfolioReturns.filter(r => r < 0).length;
  const winPct          = portfolioReturns.length > 0
    ? (positiveMonths / portfolioReturns.length) * 100 : 0;
  const avgWin          = positiveMonths > 0
    ? portfolioReturns.filter(r => r > 0).reduce((s, r) => s + r, 0) / positiveMonths : 0;
  const avgLoss         = negativeMonths > 0
    ? portfolioReturns.filter(r => r < 0).reduce((s, r) => s + r, 0) / negativeMonths : 0;

  // Inflació
  const finalValueReal  = finalValue / Math.pow(1 + inflationRate / 100, years);

  return {
    totalReturn:          round(totalReturn),
    annualizedReturn:     round(cagr),
    benchmarkTotalReturn: round(benchmarkTotal),
    benchmarkAnnualized:  round(benchmarkCAGR),
    excessReturn:         round(cagr - benchmarkCAGR),
    annualizedVolatility: round(portVol),
    benchmarkVolatility:  round(benchVol),
    maxDrawdown:          round(maxDD),
    maxDrawdownDuration:  maxDDDuration,
    averageDrawdown:      round(avgDD),
    sharpeRatio:          round(sharpe),
    sortinoRatio:         round(sortino),
    calmarRatio:          round(calmar),
    informationRatio:     round(infoRatio),
    treynorRatio:         round(treynor),
    beta:                 round(beta),
    alpha:                round(alphaAnnualized),
    trackingError:        round(trackingError),
    initialValue:         initialAmount,
    finalValue:           round(finalValue),
    totalContributions:   round(totalContribs),
    totalGain:            round(totalGain),
    finalValueReal:       round(finalValueReal),
    winningMonths:        round(winPct),
    averageWin:           round(avgWin),
    averageLoss:          round(avgLoss),
    bestMonth:            round(Math.max(...portfolioReturns, 0)),
    worstMonth:           round(Math.min(...portfolioReturns, 0)),
  };
}

// ─── YEARLY ANALYSIS ──────────────────────────────────────────────────────────

function buildYearlyAnalysis(
  portfolioSeries:  BacktestPoint[],
  benchmarkSeries:  BacktestPoint[],
  portfolioReturns: number[],
  benchmarkReturns: number[],
  startDate:        string
): YearlyAnalysis[] {

  const startYear = new Date(startDate).getFullYear();
  const years: YearlyAnalysis[] = [];

  for (let i = 0; i < Math.ceil(portfolioReturns.length / 12); i++) {
    const year       = startYear + i;
    const slice      = portfolioReturns.slice(i * 12, (i + 1) * 12);
    const bSlice     = benchmarkReturns.slice(i * 12, (i + 1) * 12);
    if (slice.length === 0) continue;

    const portReturn = ((slice.reduce((acc, r) => acc * (1 + r / 100), 1)) - 1) * 100;
    const benchReturn = ((bSlice.reduce((acc, r) => acc * (1 + r / 100), 1)) - 1) * 100;
    const vol        = annualizeVolatility(slice);
    const { maxDD }  = calculateMaxDrawdownAdvanced(slice);

    const startIdx   = i * 12;
    const endIdx     = Math.min((i + 1) * 12, portfolioSeries.length - 1);

    years.push({
      year,
      portfolioReturn:  round(portReturn),
      benchmarkReturn:  round(benchReturn),
      excess:           round(portReturn - benchReturn),
      volatility:       round(vol),
      maxDrawdown:      round(maxDD),
      startValue:       portfolioSeries[startIdx]?.value ?? 0,
      endValue:         portfolioSeries[endIdx]?.value ?? 0,
    });
  }

  return years;
}

// ─── PERFORMANCE ATTRIBUTION ──────────────────────────────────────────────────

function buildAttribution(
  portfolio:     Portfolio,
  productReturns: Map<string, number[]>,
  months:        number
): PerformanceAttribution {

  // Simplificació: atribució per classe d'actiu
  const assetClassMap = new Map<string, { pWeight: number; returns: number[] }>();

  for (const alloc of portfolio.allocations) {
    const cls     = alloc.product.assetClass;
    const returns = productReturns.get(alloc.productId) ?? new Array(months).fill(0);
    const existing = assetClassMap.get(cls);

    if (existing) {
      existing.pWeight += alloc.weight;
      for (let i = 0; i < months; i++) {
        existing.returns[i] = (existing.returns[i] ?? 0) + (returns[i] ?? 0) * (alloc.weight / 100);
      }
    } else {
      assetClassMap.set(cls, {
        pWeight: alloc.weight,
        returns: returns.map(r => r * (alloc.weight / 100)),
      });
    }
  }

  const byAssetClass: AttributionItem[] = [];
  let totalAlloc = 0;
  let totalSel   = 0;

  for (const [cls, data] of assetClassMap) {
    const portReturn = ((data.returns.reduce((acc, r) => acc * (1 + r / 100), 1)) - 1) * 100;
    const params     = ASSET_CLASS_PARAMS[cls] ?? { return: 7.0, vol: 14.0 };
    const bmkReturn  = params.return * (months / 12);
    const bmkWeight  = 100 / assetClassMap.size;

    const alloc = ((data.pWeight - bmkWeight) / 100) * (bmkReturn / 100) * 100;
    const sel   = (bmkWeight / 100) * ((portReturn - bmkReturn) / 100) * 100;
    totalAlloc += alloc;
    totalSel   += sel;

    byAssetClass.push({
      label:              formatAssetClass(cls),
      portfolioWeight:    round(data.pWeight),
      benchmarkWeight:    round(bmkWeight),
      portfolioReturn:    round(portReturn),
      benchmarkReturn:    round(bmkReturn),
      allocationEffect:   round(alloc),
      selectionEffect:    round(sel),
      totalContribution:  round(alloc + sel),
    });
  }

  // Atribució per geografia (simplificada)
  const geoMap = new Map<string, number>();
  for (const alloc of portfolio.allocations) {
    const geo = normalizeRegion(alloc.product.region);
    geoMap.set(geo, (geoMap.get(geo) ?? 0) + alloc.weight);
  }

  const byGeography: AttributionItem[] = Array.from(geoMap.entries()).map(([geo, w]) => ({
    label:              geo,
    portfolioWeight:    round(w),
    benchmarkWeight:    round(100 / geoMap.size),
    portfolioReturn:    0,
    benchmarkReturn:    0,
    allocationEffect:   0,
    selectionEffect:    0,
    totalContribution:  0,
  }));

  // Atribució per estil
  const styleMap = new Map<string, number>();
  for (const alloc of portfolio.allocations) {
    const style = alloc.product.managementType;
    styleMap.set(style, (styleMap.get(style) ?? 0) + alloc.weight);
  }

  const byManagementStyle: AttributionItem[] = Array.from(styleMap.entries()).map(([style, w]) => ({
    label:              formatManagement(style),
    portfolioWeight:    round(w),
    benchmarkWeight:    0,
    portfolioReturn:    0,
    benchmarkReturn:    0,
    allocationEffect:   0,
    selectionEffect:    0,
    totalContribution:  0,
  }));

  return {
    byAssetClass,
    byGeography,
    byManagementStyle,
    totalAllocationEffect: round(totalAlloc),
    totalSelectionEffect:  round(totalSel),
    totalInteractionEffect: 0,
  };
}

// ─── RISK ANALYSIS ─────────────────────────────────────────────────────────────

function buildRiskAnalysis(
  portfolioReturns:  number[],
  benchmarkReturns:  number[]
): RiskAnalysis {

  const sorted       = [...portfolioReturns].sort((a, b) => a - b);
  const n            = sorted.length;

  // VaR paramatric (normal distribution)
  const mean         = sorted.reduce((s, r) => s + r, 0) / n;
  const variance     = sorted.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (n - 1);
  const std          = Math.sqrt(variance);
  const var95        = -(mean - 1.645 * std);    // 95% VaR mensual
  const var99        = -(mean - 2.326 * std);    // 99% VaR mensual

  // CVaR (Expected Shortfall) - mitjana del 5% pitjor
  const tail5Idx     = Math.max(1, Math.floor(n * 0.05));
  const cvar95       = -sorted.slice(0, tail5Idx).reduce((s, r) => s + r, 0) / tail5Idx;

  // Downside deviation
  const negReturns   = portfolioReturns.filter(r => r < 0);
  const downsideDev  = negReturns.length > 1
    ? annualizeVolatility(negReturns) : 0;

  // Upside/Downside capture
  const bmkUp    = benchmarkReturns.filter((_, i) => benchmarkReturns[i] > 0);
  const portUp   = portfolioReturns.filter((_, i) => benchmarkReturns[i] > 0);
  const bmkDown  = benchmarkReturns.filter((_, i) => benchmarkReturns[i] < 0);
  const portDown = portfolioReturns.filter((_, i) => benchmarkReturns[i] < 0);

  const avgBmkUp    = bmkUp.length > 0 ? bmkUp.reduce((s, r) => s + r, 0) / bmkUp.length : 1;
  const avgPortUp   = portUp.length > 0 ? portUp.reduce((s, r) => s + r, 0) / portUp.length : 0;
  const avgBmkDown  = bmkDown.length > 0 ? bmkDown.reduce((s, r) => s + r, 0) / bmkDown.length : -1;
  const avgPortDown = portDown.length > 0 ? portDown.reduce((s, r) => s + r, 0) / portDown.length : 0;

  const upsideCapture   = avgBmkUp   !== 0 ? (avgPortUp   / avgBmkUp)   * 100 : 100;
  const downsideCapture = avgBmkDown !== 0 ? (avgPortDown / avgBmkDown) * 100 : 100;

  // Correlació
  const correlation = calculateCorrelation(portfolioReturns, benchmarkReturns);

  // Distribució
  const skewness = calculateSkewness(portfolioReturns);
  const kurtosis = calculateKurtosis(portfolioReturns);

  return {
    var95:                  round(var95),
    var99:                  round(var99),
    cvar95:                 round(cvar95),
    downsideDeviation:      round(downsideDev),
    uptureCapture:          round(upsideCapture),
    downtureCapture:        round(downsideCapture),
    correlationToBenchmark: round(correlation),
    skewness:               round(skewness),
    kurtosis:               round(kurtosis),
  };
}

// ─── STATISTICAL HELPERS ──────────────────────────────────────────────────────

function annualizeVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  return Math.sqrt(variance * 12);
}

function calculateMaxDrawdownAdvanced(returns: number[]): { maxDD: number; maxDDDuration: number } {
  let peak = 100;
  let value = 100;
  let maxDD = 0;
  let drawdownStart = 0;
  let maxDuration = 0;
  let currentDuration = 0;

  for (let i = 0; i < returns.length; i++) {
    value = value * (1 + returns[i] / 100);
    if (value > peak) {
      peak = value;
      if (currentDuration > maxDuration) maxDuration = currentDuration;
      currentDuration = 0;
      drawdownStart = i;
    } else {
      currentDuration++;
    }
    const dd = ((value - peak) / peak) * 100;
    if (dd < maxDD) maxDD = dd;
  }
  void drawdownStart;
  if (currentDuration > maxDuration) maxDuration = currentDuration;
  return { maxDD: round(maxDD), maxDDDuration: maxDuration };
}

function calculateAverageDrawdown(returns: number[]): number {
  let peak = 100;
  let value = 100;
  const dds: number[] = [];
  for (const r of returns) {
    value = value * (1 + r / 100);
    if (value > peak) peak = value;
    dds.push(((value - peak) / peak) * 100);
  }
  const negDDs = dds.filter(d => d < 0);
  return negDDs.length > 0 ? negDDs.reduce((s, d) => s + d, 0) / negDDs.length : 0;
}

function calculateBetaAlpha(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): { beta: number; alpha: number } {
  const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
  if (n < 3) return { beta: 1, alpha: 0 };

  const pR = portfolioReturns.slice(0, n);
  const bR = benchmarkReturns.slice(0, n);

  const meanP = pR.reduce((s, r) => s + r, 0) / n;
  const meanB = bR.reduce((s, r) => s + r, 0) / n;

  let cov = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    cov  += (pR[i] - meanP) * (bR[i] - meanB);
    varB += Math.pow(bR[i] - meanB, 2);
  }

  const beta  = varB !== 0 ? cov / varB : 1;
  const alpha = meanP - beta * meanB;
  return { beta: round(beta), alpha: round(alpha) };
}

function calculateCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;

  const meanA = a.slice(0, n).reduce((s, r) => s + r, 0) / n;
  const meanB = b.slice(0, n).reduce((s, r) => s + r, 0) / n;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num  += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den !== 0 ? num / den : 0;
}

function calculateSkewness(returns: number[]): number {
  const n = returns.length;
  if (n < 3) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const std  = Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / n);
  if (std === 0) return 0;
  return returns.reduce((s, r) => s + Math.pow((r - mean) / std, 3), 0) / n;
}

function calculateKurtosis(returns: number[]): number {
  const n = returns.length;
  if (n < 4) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const std  = Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / n);
  if (std === 0) return 0;
  return returns.reduce((s, r) => s + Math.pow((r - mean) / std, 4), 0) / n - 3; // excess kurtosis
}

// ─── SIMULATION ────────────────────────────────────────────────────────────────

function simulateMonthlyReturns(
  annualReturn: number,
  annualVol:    number,
  months:       number,
  seed:         string
): number[] {
  // Generem una seed determinista basada en el productId per consistència entre runs
  const seedNum = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  let state     = seedNum;

  const lcg = () => {
    state = (1664525 * state + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0xffffffff;
  };

  const monthlyR   = annualReturn / 12 / 100;
  const monthlyVol = annualVol / Math.sqrt(12) / 100;

  return Array.from({ length: months }, () => {
    // Box-Muller amb LCG determinista
    const u1 = Math.max(1e-10, lcg());
    const u2 = lcg();
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return (monthlyR + monthlyVol * z) * 100;
  });
}

function padOrTrimReturns(returns: number[], targetLength: number): number[] {
  if (returns.length >= targetLength) return returns.slice(0, targetLength);
  const padded = [...returns];
  const mean   = returns.reduce((s, r) => s + r, 0) / returns.length;
  const std    = Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length);
  while (padded.length < targetLength) {
    padded.push(mean + std * (Math.random() - 0.5) * 2);
  }
  return padded;
}

// ─── ROLLING WINDOWS ──────────────────────────────────────────────────────────

export interface RollingWindowResult {
  period:    number;      // mesos
  label:     string;
  returns:   BacktestPoint[];
  sharpe:    number;
  maxDD:     number;
  volatility: number;
}

export function calculateRollingWindows(
  portfolioSeries:  BacktestPoint[],
  portfolioReturns: number[],
  riskFreeRate:     number = 3.0
): RollingWindowResult[] {
  const windows = [
    { period: 12,  label: '1 any'   },
    { period: 36,  label: '3 anys'  },
    { period: 60,  label: '5 anys'  },
    { period: 120, label: '10 anys' },
  ].filter(w => w.period <= portfolioReturns.length);

  return windows.map(({ period, label }) => {
    const slice   = portfolioReturns.slice(-period);
    const vol     = annualizeVolatility(slice);
    const ret     = ((slice.reduce((acc, r) => acc * (1 + r / 100), 1)) - 1) * 100;
    const annRet  = (Math.pow(1 + ret / 100, 12 / period) - 1) * 100;
    const sharpe  = vol > 0 ? (annRet - riskFreeRate) / vol : 0;
    const { maxDD } = calculateMaxDrawdownAdvanced(slice);

    const returns = portfolioSeries.slice(-period).map(p => ({ date: p.date, value: p.value }));

    return { period, label, returns, sharpe: round(sharpe), maxDD: round(maxDD), volatility: round(vol) };
  });
}

// ─── FORMATTERS & HELPERS ─────────────────────────────────────────────────────

function monthsBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  return Math.max(0,
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatAssetClass(cls: string): string {
  const labels: Record<string, string> = {
    'monetari':               'Monetari',
    'renda-fixa-curta':       'RF Curta Durada',
    'renda-fixa-global':      'RF Global',
    'renda-fixa-europa':      'RF Europa',
    'renda-variable-global':  'RV Global',
    'renda-variable-usa':     'RV EUA',
    'renda-variable-europa':  'RV Europa',
    'renda-variable-espanya': 'RV Espanya',
    'renda-variable-emergents':'RV Emergents',
    'small-caps-global':      'Small Caps Global',
    'small-caps-europa':      'Small Caps Europa',
    'tecnologia':             'Tecnologia',
    'energia':                'Energia',
    'salut-biotech':          'Salut & Biotech',
    'dividends-income':       'Dividends & Income',
    'esg':                    'ESG / Sostenible',
    'immobiliari-reits':      'Immobiliari REITs',
  };
  return labels[cls] ?? cls;
}

function formatManagement(type: string): string {
  const labels: Record<string, string> = {
    'indexada': 'Indexada (Passiva)',
    'passiva':  'Passiva',
    'activa':   'Activa',
  };
  return labels[type] ?? type;
}

function normalizeRegion(region: string): string {
  if (region.includes('Global'))    return 'Global';
  if (region.includes('Europa') || region.includes('Europe')) return 'Europa';
  if (region.includes('EUA') || region.includes('USA') || region.includes('US')) return 'EUA';
  if (region.includes('Emergent'))  return 'Emergents';
  if (region.includes('Espanya') || region.includes('Ibèria')) return 'Ibèria';
  return region;
}

function buildDataWarnings(
  months:           number,
  productsSimulated: number,
  totalProducts:    number
): string[] {
  const warnings: string[] = [];
  if (months < 12)  warnings.push('Període de backtest molt curt (< 1 any). Les mètriques poden no ser representatives.');
  if (months > 240) warnings.push('Període de backtest molt llarg. La fiabilitat de dades antigues pot ser limitada.');
  if (productsSimulated > 0)
    warnings.push(`${productsSimulated}/${totalProducts} productes utilitzen retorns simulats. Configura FMP_API_KEY per a dades reals.`);
  if (months < 60)  warnings.push('Es recomana un mínim de 5 anys per a mètriques estadísticament significatives.');
  return warnings;
}

function buildEmptyResult(config: BacktestConfig): BacktestResult {
  const emptyMetrics: BacktestMetrics = {
    totalReturn: 0, annualizedReturn: 0, benchmarkTotalReturn: 0, benchmarkAnnualized: 0,
    excessReturn: 0, annualizedVolatility: 0, benchmarkVolatility: 0,
    maxDrawdown: 0, maxDrawdownDuration: 0, averageDrawdown: 0,
    sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, informationRatio: 0,
    treynorRatio: 0, beta: 1, alpha: 0, trackingError: 0,
    initialValue: config.initialAmount, finalValue: config.initialAmount,
    totalContributions: config.initialAmount, totalGain: 0, finalValueReal: config.initialAmount,
    winningMonths: 0, averageWin: 0, averageLoss: 0, bestMonth: 0, worstMonth: 0,
  };
  return {
    config,
    portfolioSeries: [],
    benchmarkSeries: [],
    contributionSeries: [],
    drawdownSeries: [],
    metrics: emptyMetrics,
    yearlyAnalysis: [],
    attribution: { byAssetClass: [], byGeography: [], byManagementStyle: [], totalAllocationEffect: 0, totalSelectionEffect: 0, totalInteractionEffect: 0 },
    riskAnalysis: { var95: 0, var99: 0, cvar95: 0, downsideDeviation: 0, uptureCapture: 100, downtureCapture: 100, correlationToBenchmark: 0, skewness: 0, kurtosis: 0 },
    dataQuality: { source: 'simulated', productsWithRealData: 0, productsSimulated: 0, dataCompleteness: 0, note: 'Període de dates invàlid.', warnings: [] },
  };
}

// ─── PUBLIC HELPERS ───────────────────────────────────────────────────────────

export function getBacktestStatusColor(source: BacktestDataQuality['source']): string {
  return source === 'real' ? 'bg-green-100 text-green-800'
       : source === 'mixed' ? 'bg-yellow-100 text-yellow-800'
       : 'bg-blue-100 text-blue-800';
}

export function formatBacktestMetric(value: number, type: 'pct' | 'ratio' | 'eur'): string {
  if (type === 'pct')   return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  if (type === 'ratio') return value.toFixed(2);
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

export function getMetricQualityLabel(metric: string, value: number): { label: string; color: string } {
  const thresholds: Record<string, { good: number; bad: number; inverse: boolean }> = {
    sharpeRatio:     { good: 1.0, bad: 0.3, inverse: false },
    sortinoRatio:    { good: 1.0, bad: 0.3, inverse: false },
    calmarRatio:     { good: 0.5, bad: 0.1, inverse: false },
    maxDrawdown:     { good: -10, bad: -30, inverse: true  },
    trackingError:   { good: 3,   bad: 8,   inverse: true  },
    winningMonths:   { good: 60,  bad: 45,  inverse: false },
  };

  const t = thresholds[metric];
  if (!t) return { label: '', color: '' };

  const isGood = t.inverse ? value > t.good : value >= t.good;
  const isBad  = t.inverse ? value < t.bad  : value <= t.bad;

  if (isGood) return { label: 'Excel·lent', color: 'text-green-600' };
  if (isBad)  return { label: 'Millorable', color: 'text-red-600'   };
  return { label: 'Acceptable', color: 'text-amber-600' };
}

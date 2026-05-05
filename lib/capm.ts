/**
 * CAPM — Capital Asset Pricing Model
 *
 * E(Ri) = Rf + βi × (E(Rm) − Rf)
 *
 * where:
 *   Rf  = risk-free rate (ECB €STR or deposit rate)
 *   βi  = asset/portfolio systematic risk vs market
 *   Rm  = expected market return (historical equity risk premium + Rf)
 *
 * Historical EUR equity risk premium source: Damodaran (Jan 2024) — 5.3%
 */

export interface CAPMInputs {
  riskFreeRate: number;   // annual %, e.g. 3.15
  beta: number;           // e.g. 1.2
  marketReturnPremium?: number; // ERP annual %, defaults to 5.3 (Damodaran EUR 2024)
}

export interface CAPMResult {
  expectedReturn: number;   // annual %
  riskFreeRate: number;     // annual %
  beta: number;
  marketReturnPremium: number;
  excessReturn: number;     // expectedReturn - riskFreeRate
}

/** Damodaran EUR equity risk premium, Jan 2024 */
export const DAMODARAN_ERP_EUR = 5.3;

/**
 * Computes CAPM expected return for a single asset or portfolio.
 */
export function capmExpectedReturn(inputs: CAPMInputs): CAPMResult {
  const { riskFreeRate, beta, marketReturnPremium = DAMODARAN_ERP_EUR } = inputs;
  const expectedReturn = riskFreeRate + beta * marketReturnPremium;
  return {
    expectedReturn,
    riskFreeRate,
    beta,
    marketReturnPremium,
    excessReturn: expectedReturn - riskFreeRate,
  };
}

export interface SecurityReturn {
  returnPct: number; // periodic % return of the asset
}

export interface MarketReturn {
  returnPct: number; // same-period % return of the market benchmark
}

/**
 * Estimates beta from paired asset/market return arrays using OLS regression.
 * Returns NaN if fewer than 2 data points are provided.
 */
export function estimateBeta(
  assetReturns: SecurityReturn[],
  marketReturns: MarketReturn[],
): number {
  const n = Math.min(assetReturns.length, marketReturns.length);
  if (n < 2) return NaN;

  const xs = marketReturns.slice(0, n).map(r => r.returnPct);
  const ys = assetReturns.slice(0, n).map(r => r.returnPct);

  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;

  let cov = 0;
  let varX = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cov  += dx * dy;
    varX += dx * dx;
  }

  if (varX === 0) return NaN;
  return cov / varX;
}

/**
 * Jensen's alpha: actual return minus CAPM-predicted return.
 * Positive alpha → outperformed on a risk-adjusted basis.
 */
export function jensensAlpha(
  actualReturn: number,
  capmResult: CAPMResult,
): number {
  return actualReturn - capmResult.expectedReturn;
}

/**
 * Treynor ratio: excess return per unit of systematic (beta) risk.
 */
export function treynorRatio(
  portfolioReturn: number,
  riskFreeRate: number,
  beta: number,
): number {
  if (beta === 0) return 0;
  return (portfolioReturn - riskFreeRate) / beta;
}

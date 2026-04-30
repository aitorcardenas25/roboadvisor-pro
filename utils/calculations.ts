// utils/calculations.ts
// Funcions de càlcul financer d'utilitat general

// ─── VALOR FUTUR ───────────────────────────────────────────────────────────────

export function futureValue(
  initialAmount:       number,
  annualReturn:        number,  // %
  years:               number,
  monthlyContribution: number = 0
): number {
  const monthlyR     = annualReturn / 12 / 100;
  const totalMonths  = years * 12;
  const fvInitial    = initialAmount * Math.pow(1 + monthlyR, totalMonths);
  const fvContribs   = monthlyR > 0
    ? monthlyContribution * ((Math.pow(1 + monthlyR, totalMonths) - 1) / monthlyR)
    : monthlyContribution * totalMonths;
  return Math.round((fvInitial + fvContribs) * 100) / 100;
}

// ─── REQUERIMENT MENSUAL ───────────────────────────────────────────────────────

export function requiredMonthlyContribution(
  targetAmount:    number,
  initialAmount:   number,
  annualReturn:    number,  // %
  years:           number
): number {
  const monthlyR    = annualReturn / 12 / 100;
  const totalMonths = years * 12;
  const fvInitial   = initialAmount * Math.pow(1 + monthlyR, totalMonths);
  const remaining   = targetAmount - fvInitial;
  if (remaining <= 0) return 0;
  if (monthlyR === 0) return remaining / totalMonths;
  return remaining / ((Math.pow(1 + monthlyR, totalMonths) - 1) / monthlyR);
}

// ─── CAGR ─────────────────────────────────────────────────────────────────────

export function calculateCAGR(
  initialValue: number,
  finalValue:   number,
  years:        number
): number {
  if (initialValue <= 0 || years <= 0) return 0;
  return (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100;
}

// ─── RENDIBILITAT TOTAL ────────────────────────────────────────────────────────

export function totalReturn(initialValue: number, finalValue: number): number {
  if (initialValue <= 0) return 0;
  return ((finalValue - initialValue) / initialValue) * 100;
}

// ─── INFLACIÓ ─────────────────────────────────────────────────────────────────

export function realReturn(nominalReturn: number, inflationRate: number): number {
  return ((1 + nominalReturn / 100) / (1 + inflationRate / 100) - 1) * 100;
}

export function inflationAdjustedValue(
  nominalValue:  number,
  inflationRate: number,  // %
  years:         number
): number {
  return nominalValue / Math.pow(1 + inflationRate / 100, years);
}

// ─── TER PONDERAT ─────────────────────────────────────────────────────────────

export function weightedTER(
  allocations: { weight: number; ter: number }[]
): number {
  const total = allocations.reduce((sum, a) => sum + a.weight * a.ter, 0);
  return Math.round((total / 100) * 1000) / 1000;
}

// ─── RÀTIO DE SHARPE ──────────────────────────────────────────────────────────

export function sharpeRatio(
  portfolioReturn: number,
  riskFreeRate:    number,
  volatility:      number
): number {
  if (volatility <= 0) return 0;
  return (portfolioReturn - riskFreeRate) / volatility;
}

// ─── DIVERSIFICACIÓ ───────────────────────────────────────────────────────────

export function herfindahlIndex(weights: number[]): number {
  return weights.reduce((sum, w) => sum + Math.pow(w / 100, 2), 0);
}

export function effectiveN(weights: number[]): number {
  const hhi = herfindahlIndex(weights);
  return hhi > 0 ? 1 / hhi : 0;
}

// ─── PROBABILITAT (aproximació normal) ────────────────────────────────────────

export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p  = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  const erf = 1.0 - poly * Math.exp(-absX * absX);
  return 0.5 * (1.0 + sign * erf);
}

export function probabilityOfReturn(
  targetReturn:     number,
  expectedReturn:   number,
  volatility:       number,
  years:            number
): number {
  if (volatility <= 0) return targetReturn <= expectedReturn ? 100 : 0;
  const z = (targetReturn - expectedReturn * years) / (volatility * Math.sqrt(years));
  return (1 - normalCDF(z)) * 100;
}

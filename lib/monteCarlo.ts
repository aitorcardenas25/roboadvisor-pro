// lib/monteCarlo.ts
// Simulació Monte Carlo per a projeccions de cartera

import { Portfolio } from './portfolio';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface MonteCarloParams {
  initialInvestment: number;
  monthlyContribution: number;
  investmentHorizon: number;      // anys
  annualReturn: number;           // % rendibilitat anual esperada
  annualVolatility: number;       // % volatilitat anual
  inflationRate?: number;         // % inflació anual (default 2.5%)
  numSimulations?: number;        // nombre de simulacions (default 1000)
  riskFreeRate?: number;          // % tipus lliure de risc (default 3.0%)
}

export interface MonteCarloResult {
  params: MonteCarloParams;
  percentiles: MonteCarloPercentiles;
  projectionData: MonteCarloProjection[];
  summary: MonteCarloSummary;
  probabilityAnalysis: ProbabilityAnalysis;
  inflationAdjusted: InflationAdjustedResult;
  status: 'completed' | 'estimated' | 'error';
  note: string;
}

export interface MonteCarloPercentiles {
  p10: number;    // Escenari pessimista (10è percentil)
  p25: number;    // Escenari conservador (25è percentil)
  p50: number;    // Escenari central / mediana
  p75: number;    // Escenari optimista (75è percentil)
  p90: number;    // Escenari molt optimista (90è percentil)
}

export interface MonteCarloProjection {
  year: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  contributions: number;    // total aportacions acumulades
  inflationP50: number;     // P50 ajustat per inflació
}

export interface MonteCarloSummary {
  totalInvested: number;         // total capital aportat
  medianFinalValue: number;      // valor final mediana
  medianGain: number;            // guany net mediana
  medianGainPercentage: number;  // % guany net mediana
  bestCase: number;              // P90 valor final
  worstCase: number;             // P10 valor final
  probabilityOfLoss: number;     // % probabilitat de pèrdua
  probabilityOfDoubling: number; // % probabilitat de doblar
  expectedAnnualizedReturn: number;
}

export interface ProbabilityAnalysis {
  probabilityPositiveReturn: number;   // % prob retorn positiu
  probabilityBeatInflation: number;    // % prob batre inflació
  probabilityReachTarget: number;      // % prob assolir objectiu
  targetAmount: number;
  confidenceInterval90: [number, number]; // [P5, P95]
  confidenceInterval68: [number, number]; // [P16, P84]
}

export interface InflationAdjustedResult {
  inflationRate: number;
  p50NominalValue: number;
  p50RealValue: number;
  purchasingPowerLoss: number;  // % pèrdua de poder adquisitiu
  realAnnualizedReturn: number; // rendibilitat real anualitzada
}

// ─── MAIN MONTE CARLO ENGINE ──────────────────────────────────────────────────

export function runMonteCarlo(
  params: MonteCarloParams,
  targetAmount?: number
): MonteCarloResult {

  const {
    initialInvestment,
    monthlyContribution,
    investmentHorizon,
    annualReturn,
    annualVolatility,
    inflationRate = 2.5,
    numSimulations = 1000,
    riskFreeRate = 3.0,
  } = params;

  // Validacions bàsiques
  if (
    initialInvestment < 0 ||
    investmentHorizon <= 0 ||
    annualReturn === undefined ||
    annualVolatility === undefined
  ) {
    return buildErrorResult(params);
  }

  const monthlyReturn = annualReturn / 12 / 100;
  const monthlyVol    = annualVolatility / Math.sqrt(12) / 100;
  const totalMonths   = investmentHorizon * 12;

  // ── Executar simulacions ──────────────────────────────────────────────────
  const allSimulations: number[][] = [];

  for (let sim = 0; sim < numSimulations; sim++) {
    const yearlyValues: number[] = [];
    let value = initialInvestment;

    for (let month = 1; month <= totalMonths; month++) {
      // Rendiment mensual aleatori amb distribució log-normal
      const randomReturn = monthlyReturn + monthlyVol * boxMullerRandom();
      value = value * (1 + randomReturn) + monthlyContribution;
      value = Math.max(0, value); // no pot ser negatiu

      // Guardem valor a final de cada any
      if (month % 12 === 0) {
        yearlyValues.push(value);
      }
    }

    allSimulations.push(yearlyValues);
  }

  // ── Calcular percentils per any ───────────────────────────────────────────
  const projectionData: MonteCarloProjection[] = [];
  const inflationFactor = inflationRate / 100;

  for (let year = 1; year <= investmentHorizon; year++) {
    const yearValues = allSimulations
      .map(sim => sim[year - 1] ?? 0)
      .sort((a, b) => a - b);

    const contributions = initialInvestment + monthlyContribution * 12 * year;
    const p50Value      = getPercentile(yearValues, 50);
    const inflationP50  = p50Value / Math.pow(1 + inflationFactor, year);

    projectionData.push({
      year,
      p10: Math.round(getPercentile(yearValues, 10)),
      p25: Math.round(getPercentile(yearValues, 25)),
      p50: Math.round(p50Value),
      p75: Math.round(getPercentile(yearValues, 75)),
      p90: Math.round(getPercentile(yearValues, 90)),
      contributions: Math.round(contributions),
      inflationP50:  Math.round(inflationP50),
    });
  }

  // ── Percentils finals ─────────────────────────────────────────────────────
  const finalValues = allSimulations
    .map(sim => sim[investmentHorizon - 1] ?? 0)
    .sort((a, b) => a - b);

  const percentiles: MonteCarloPercentiles = {
    p10: Math.round(getPercentile(finalValues, 10)),
    p25: Math.round(getPercentile(finalValues, 25)),
    p50: Math.round(getPercentile(finalValues, 50)),
    p75: Math.round(getPercentile(finalValues, 75)),
    p90: Math.round(getPercentile(finalValues, 90)),
  };

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalInvested = initialInvestment + monthlyContribution * totalMonths;
  const medianFinal   = percentiles.p50;
  const medianGain    = medianFinal - totalInvested;

  const numLosses = finalValues.filter(v => v < totalInvested).length;
  const numDouble = finalValues.filter(v => v >= totalInvested * 2).length;

  // Rendibilitat anualitzada implícita de la mediana
  const medianAnnReturn = totalInvested > 0 && investmentHorizon > 0
    ? (Math.pow(medianFinal / initialInvestment, 1 / investmentHorizon) - 1) * 100
    : 0;

  const summary: MonteCarloSummary = {
    totalInvested,
    medianFinalValue:        medianFinal,
    medianGain:              Math.round(medianGain),
    medianGainPercentage:    Math.round((medianGain / totalInvested) * 10000) / 100,
    bestCase:                percentiles.p90,
    worstCase:               percentiles.p10,
    probabilityOfLoss:       Math.round((numLosses / numSimulations) * 1000) / 10,
    probabilityOfDoubling:   Math.round((numDouble / numSimulations) * 1000) / 10,
    expectedAnnualizedReturn: Math.round(medianAnnReturn * 100) / 100,
  };

  // ── Probability Analysis ──────────────────────────────────────────────────
  const inflationTarget   = totalInvested * Math.pow(1 + inflationFactor, investmentHorizon);
  const target            = targetAmount ?? totalInvested * 1.5;

  const numPositive       = finalValues.filter(v => v > totalInvested).length;
  const numBeatInflation  = finalValues.filter(v => v > inflationTarget).length;
  const numReachTarget    = finalValues.filter(v => v >= target).length;

  const probabilityAnalysis: ProbabilityAnalysis = {
    probabilityPositiveReturn: Math.round((numPositive / numSimulations) * 1000) / 10,
    probabilityBeatInflation:  Math.round((numBeatInflation / numSimulations) * 1000) / 10,
    probabilityReachTarget:    Math.round((numReachTarget / numSimulations) * 1000) / 10,
    targetAmount:              Math.round(target),
    confidenceInterval90:      [
      Math.round(getPercentile(finalValues, 5)),
      Math.round(getPercentile(finalValues, 95)),
    ],
    confidenceInterval68:      [
      Math.round(getPercentile(finalValues, 16)),
      Math.round(getPercentile(finalValues, 84)),
    ],
  };

  // ── Inflation Adjusted ────────────────────────────────────────────────────
  const p50Real        = Math.round(medianFinal / Math.pow(1 + inflationFactor, investmentHorizon));
  const realAnnReturn  = Math.round(((annualReturn - inflationRate) / (1 + inflationRate / 100)) * 100) / 100;
  const ppLoss         = Math.round(((medianFinal - p50Real) / medianFinal) * 10000) / 100;

  const inflationAdjusted: InflationAdjustedResult = {
    inflationRate,
    p50NominalValue:      medianFinal,
    p50RealValue:         p50Real,
    purchasingPowerLoss:  ppLoss,
    realAnnualizedReturn: realAnnReturn,
  };

  return {
    params,
    percentiles,
    projectionData,
    summary,
    probabilityAnalysis,
    inflationAdjusted,
    status: 'completed',
    note: `Simulació basada en ${numSimulations.toLocaleString()} escenaris aleatoris. Els resultats són orientatius i no garanteixen rendibilitats futures. Els mercats financers comporten risc de pèrdua de capital.`,
  };
}

// ─── PORTFOLIO MONTE CARLO ────────────────────────────────────────────────────

export function runPortfolioMonteCarlo(
  portfolio: Portfolio,
  questionnaire: {
    initialInvestment: number;
    monthlyContribution: number;
    investmentHorizon: number;
    targetAmount: number;
  }
): MonteCarloResult {

  const params: MonteCarloParams = {
    initialInvestment:   questionnaire.initialInvestment,
    monthlyContribution: questionnaire.monthlyContribution,
    investmentHorizon:   questionnaire.investmentHorizon,
    annualReturn:        portfolio.expectedReturn,
    annualVolatility:    portfolio.expectedVolatility,
    inflationRate:       2.5,
    numSimulations:      1000,
    riskFreeRate:        3.0,
  };

  return runMonteCarlo(params, questionnaire.targetAmount);
}

// ─── SCENARIO ANALYSIS ────────────────────────────────────────────────────────

export interface ScenarioAnalysis {
  scenarios: Scenario[];
  recommendation: string;
}

export interface Scenario {
  name: string;
  description: string;
  returnAssumption: number;
  volatilityAssumption: number;
  finalValue: number;
  probability: string;
  color: string;
}

export function buildScenarioAnalysis(
  portfolio: Portfolio,
  initialInvestment: number,
  monthlyContribution: number,
  horizon: number
): ScenarioAnalysis {

  const baseReturn = portfolio.expectedReturn;
  const baseVol    = portfolio.expectedVolatility;

  const scenarios: Scenario[] = [
    {
      name:                 'Escenari Molt Advers',
      description:          'Crisis financera severa, recessió prolongada i alt estrès de mercat.',
      returnAssumption:     baseReturn - baseVol * 1.5,
      volatilityAssumption: baseVol * 1.8,
      finalValue:           0,
      probability:          '~10%',
      color:                '#ef4444',
    },
    {
      name:                 'Escenari Advers',
      description:          'Mercat bajista moderat, creixement econòmic lent.',
      returnAssumption:     baseReturn - baseVol * 0.75,
      volatilityAssumption: baseVol * 1.3,
      finalValue:           0,
      probability:          '~20%',
      color:                '#f97316',
    },
    {
      name:                 'Escenari Base',
      description:          'Evolució consistent amb les expectatives històriques del mercat.',
      returnAssumption:     baseReturn,
      volatilityAssumption: baseVol,
      finalValue:           0,
      probability:          '~40%',
      color:                '#3b82f6',
    },
    {
      name:                 'Escenari Favorable',
      description:          'Expansió econòmica, mercat alcista sostingut.',
      returnAssumption:     baseReturn + baseVol * 0.5,
      volatilityAssumption: baseVol * 0.8,
      finalValue:           0,
      probability:          '~20%',
      color:                '#10b981',
    },
    {
      name:                 'Escenari Molt Favorable',
      description:          'Creixement excepcional i condicions de mercat ideals.',
      returnAssumption:     baseReturn + baseVol * 1.0,
      volatilityAssumption: baseVol * 0.7,
      finalValue:           0,
      probability:          '~10%',
      color:                '#8b5cf6',
    },
  ];

  // Calcular valor final per cada escenari
  for (const scenario of scenarios) {
    const monthlyR = Math.max(-0.99, scenario.returnAssumption / 12 / 100);
    const months   = horizon * 12;
    let value      = initialInvestment;

    for (let m = 0; m < months; m++) {
      value = value * (1 + monthlyR) + monthlyContribution;
      value = Math.max(0, value);
    }

    scenario.finalValue = Math.round(value);
  }

  const baseScenario = scenarios[2];
  const recommendation = buildScenarioRecommendation(
    baseScenario.finalValue,
    initialInvestment + monthlyContribution * horizon * 12,
    portfolio.profile
  );

  return { scenarios, recommendation };
}

function buildScenarioRecommendation(
  finalValue: number,
  totalInvested: number,
  profile: string
): string {
  const ratio = totalInvested > 0 ? finalValue / totalInvested : 1;

  if (ratio >= 2.0) {
    return `En l'escenari base, la cartera podria doblar el capital invertit en l'horitzó establert. El perfil ${profile} és coherent amb les expectatives de rendibilitat.`;
  }
  if (ratio >= 1.5) {
    return `En l'escenari base, la cartera podria generar un retorn significatiu del ${Math.round((ratio - 1) * 100)}% sobre el capital invertit. Les expectatives s'alineen amb el perfil ${profile}.`;
  }
  if (ratio >= 1.0) {
    return `En l'escenari base, la cartera podria generar un retorn moderat. Considera augmentar les aportacions mensuals per millorar les perspectives de l'objectiu financer.`;
  }
  return `L'escenari base mostra limitacions per assolir l'objectiu. Considera ampliar l'horitzó temporal, augmentar les aportacions o revisar el perfil d'inversió.`;
}

// ─── PERCENTILE HELPERS ───────────────────────────────────────────────────────

function getPercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sortedValues[lower];

  const fraction = index - lower;
  return sortedValues[lower] * (1 - fraction) + sortedValues[upper] * fraction;
}

// Box-Muller: genera número aleatori normal (0,1)
function boxMullerRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─── ERROR RESULT ─────────────────────────────────────────────────────────────

function buildErrorResult(params: MonteCarloParams): MonteCarloResult {
  const empty: MonteCarloPercentiles = { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 };

  return {
    params,
    percentiles: empty,
    projectionData: [],
    summary: {
      totalInvested:            0,
      medianFinalValue:         0,
      medianGain:               0,
      medianGainPercentage:     0,
      bestCase:                 0,
      worstCase:                0,
      probabilityOfLoss:        0,
      probabilityOfDoubling:    0,
      expectedAnnualizedReturn: 0,
    },
    probabilityAnalysis: {
      probabilityPositiveReturn: 0,
      probabilityBeatInflation:  0,
      probabilityReachTarget:    0,
      targetAmount:              0,
      confidenceInterval90:      [0, 0],
      confidenceInterval68:      [0, 0],
    },
    inflationAdjusted: {
      inflationRate:        2.5,
      p50NominalValue:      0,
      p50RealValue:         0,
      purchasingPowerLoss:  0,
      realAnnualizedReturn: 0,
    },
    status: 'error',
    note:   'No s\'ha pogut executar la simulació. Revisa els paràmetres d\'entrada.',
  };
}

// ─── FORMAT HELPERS ───────────────────────────────────────────────────────────

export function formatMonteCarloValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M €`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k €`;
  }
  return `${value.toFixed(0)} €`;
}

export function getPercentileInterpretation(percentile: 'p10' | 'p50' | 'p90'): string {
  const interpretations = {
    p10: 'Escenari pessimista (P10): En el 10% dels casos més desfavorables, el valor final seria inferior a aquest import. Representa un context de mercat molt advers.',
    p50: 'Escenari central (P50 / Mediana): La meitat de les simulacions generen un valor final superior i l\'altra meitat inferior. És l\'estimació central més probable.',
    p90: 'Escenari optimista (P90): En el 10% dels casos més favorables, el valor final superaria aquest import. Representa condicions de mercat molt favorables.',
  };
  return interpretations[percentile];
}

export function getProbabilityColor(probability: number): string {
  if (probability >= 75) return 'text-green-600';
  if (probability >= 50) return 'text-blue-600';
  if (probability >= 25) return 'text-amber-600';
  return 'text-red-600';
}

export function getProbabilityLabel(probability: number): string {
  if (probability >= 80) return 'Molt probable';
  if (probability >= 60) return 'Probable';
  if (probability >= 40) return 'Possible';
  if (probability >= 20) return 'Poc probable';
  return 'Improbable';
}
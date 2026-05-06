/**
 * Adapter between InvestorProfile → Markowitz optimizer.
 *
 * Maps each investor profile to a representative set of asset classes with
 * CAPM-derived expected returns, then runs optimizePortfolio(). If anything
 * fails (bad inputs, numerical issues) it returns source='fallback' so
 * buildPortfolio() silently uses the hardcoded model portfolio.
 */

import {
  optimizePortfolio,
  computeCorrelationMatrix,
  identityCorrelationMatrix,
  type Asset,
  type OptimizationConstraints,
} from './optimization';
import { capmExpectedReturn, DAMODARAN_ERP_EUR } from './capm';
import type { InvestorProfile } from './products';

// ── Tipus públic ──────────────────────────────────────────────────────────────

export type OptimizationSource = 'mpt-optimized' | 'profile-model';

export interface AdapterResult {
  source: OptimizationSource;
  expectedReturn: number;   // % anual
  expectedVolatility: number; // % anual
  expectedSharpe: number;
  /** Normalized weights per asset class (same order as PROFILE_ASSETS[profile]) */
  weights: number[];
  assetIds: string[];
}

// ── Paràmetres de mercat ──────────────────────────────────────────────────────

// Risk-free rate: ECB €STR aproximació (sincròn — fallback estàtic si no hi ha xarxa)
const RF = 3.0; // %

// Estimated beta per asset class (proxy CAPM)
const ASSET_BETAS: Record<string, number> = {
  'monetari':              0.00,
  'renda-fixa-curta':      0.05,
  'renda-fixa-global':     0.15,
  'renda-fixa-europa':     0.20,
  'renda-variable-global': 1.00,
  'renda-variable-usa':    1.10,
  'renda-variable-europa': 0.90,
  'renda-variable-emergents': 1.30,
  'renda-variable-small-caps': 1.20,
  'immobiliari':           0.60,
  'tecnologia':            1.35,
  'salut':                 0.75,
  'energia':               0.85,
};

// Historical annualised volatility per asset class (%)
const ASSET_VOLS: Record<string, number> = {
  'monetari':              0.5,
  'renda-fixa-curta':      2.0,
  'renda-fixa-global':     5.0,
  'renda-fixa-europa':     6.0,
  'renda-variable-global': 15.0,
  'renda-variable-usa':    17.0,
  'renda-variable-europa': 16.0,
  'renda-variable-emergents': 22.0,
  'renda-variable-small-caps': 20.0,
  'immobiliari':           14.0,
  'tecnologia':            25.0,
  'salut':                 14.0,
  'energia':               22.0,
};

// Historical correlation matrix (asset classes in order of UNIVERSE)
// Source: approximate 20-year averages, Damodaran / Bloomberg data
const UNIVERSE = [
  'monetari', 'renda-fixa-curta', 'renda-fixa-global',
  'renda-variable-global', 'renda-variable-usa', 'renda-variable-europa',
  'renda-variable-emergents', 'immobiliari', 'tecnologia',
];

const CORR_MATRIX = [
  //  mon   rfc   rfg    rvg   rvu   rve   rve2  imm   tec
  [ 1.00,  0.75,  0.40, -0.05, -0.10, -0.05, -0.05,  0.10, -0.10 ], // monetari
  [ 0.75,  1.00,  0.70, -0.15, -0.20, -0.10, -0.10,  0.15, -0.15 ], // rf-curta
  [ 0.40,  0.70,  1.00, -0.10, -0.15,  0.00,  0.00,  0.20, -0.10 ], // rf-global
  [-0.05, -0.15, -0.10,  1.00,  0.90,  0.85,  0.75,  0.55,  0.85 ], // rv-global
  [-0.10, -0.20, -0.15,  0.90,  1.00,  0.75,  0.65,  0.45,  0.90 ], // rv-usa
  [-0.05, -0.10,  0.00,  0.85,  0.75,  1.00,  0.70,  0.50,  0.75 ], // rv-europa
  [-0.05, -0.10,  0.00,  0.75,  0.65,  0.70,  1.00,  0.50,  0.65 ], // rv-emergents
  [ 0.10,  0.15,  0.20,  0.55,  0.45,  0.50,  0.50,  1.00,  0.40 ], // immobiliari
  [-0.10, -0.15, -0.10,  0.85,  0.90,  0.75,  0.65,  0.40,  1.00 ], // tecnologia
];

// ── Conjunt d'actius per perfil ───────────────────────────────────────────────

const PROFILE_ASSETS: Record<InvestorProfile, string[]> = {
  conservador: [
    'monetari', 'renda-fixa-curta', 'renda-fixa-global', 'renda-variable-global',
  ],
  moderat: [
    'renda-fixa-curta', 'renda-fixa-global',
    'renda-variable-global', 'renda-variable-usa', 'renda-variable-europa',
  ],
  dinamic: [
    'renda-variable-global', 'renda-variable-usa', 'renda-variable-europa',
    'renda-variable-emergents', 'renda-fixa-global',
  ],
  agressiu: [
    'renda-variable-global', 'renda-variable-usa', 'renda-variable-emergents',
    'tecnologia', 'immobiliari',
  ],
};

const PROFILE_CONSTRAINTS: Record<InvestorProfile, OptimizationConstraints> = {
  conservador: { minWeight: 0.05, maxWeight: 0.60, riskFreeRate: RF },
  moderat:     { minWeight: 0.05, maxWeight: 0.55, riskFreeRate: RF },
  dinamic:     { minWeight: 0.05, maxWeight: 0.60, riskFreeRate: RF },
  agressiu:    { minWeight: 0.05, maxWeight: 0.65, riskFreeRate: RF },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function capmReturn(assetClass: string, rf: number): number {
  const beta = ASSET_BETAS[assetClass] ?? 1.0;
  return capmExpectedReturn({
    riskFreeRate: rf,
    beta,
    marketReturnPremium: DAMODARAN_ERP_EUR,
  }).expectedReturn;
}

function subCorrelationMatrix(assetClasses: string[]): number[][] {
  return assetClasses.map(row => {
    const ri = UNIVERSE.indexOf(row);
    return assetClasses.map(col => {
      const ci = UNIVERSE.indexOf(col);
      if (ri === -1 || ci === -1) return row === col ? 1 : 0;
      return CORR_MATRIX[ri][ci];
    });
  });
}

// ── Funció principal ──────────────────────────────────────────────────────────

/**
 * Tries to run Markowitz optimization for the given profile.
 * Returns source='fallback' if the optimization cannot produce a valid result.
 */
export function optimizeFromProfile(profile: InvestorProfile, rf = RF): AdapterResult {
  try {
    const assetIds = PROFILE_ASSETS[profile];
    const constraints = { ...PROFILE_CONSTRAINTS[profile], riskFreeRate: rf };

    const assets: Asset[] = assetIds.map(ac => ({
      id: ac,
      expectedReturn: capmReturn(ac, rf),
      volatility: ASSET_VOLS[ac] ?? 15,
    }));

    const corrRows = subCorrelationMatrix(assetIds);
    const hasFullMatrix = corrRows.every(row => row.every(v => v !== 0 || true));
    const matrix = hasFullMatrix
      ? { correlations: corrRows }
      : identityCorrelationMatrix(assets.length);

    const result = optimizePortfolio(assets, matrix, constraints);
    const tp = result.tangencyPortfolio;

    if (!isFinite(tp.expectedReturn) || !isFinite(tp.volatility)) {
      return fallback(profile, assetIds);
    }

    const sharpe = tp.volatility > 0
      ? (tp.expectedReturn - rf) / tp.volatility
      : 0;

    return {
      source: 'mpt-optimized',
      expectedReturn: Math.round(tp.expectedReturn * 10) / 10,
      expectedVolatility: Math.round(tp.volatility * 10) / 10,
      expectedSharpe: Math.round(sharpe * 100) / 100,
      weights: tp.weights,
      assetIds,
    };
  } catch {
    return fallback(profile, PROFILE_ASSETS[profile]);
  }
}

// ── Fallback estàtic ──────────────────────────────────────────────────────────

const FALLBACK_PARAMS: Record<InvestorProfile, Pick<AdapterResult, 'expectedReturn' | 'expectedVolatility' | 'expectedSharpe'>> = {
  conservador: { expectedReturn: 2.5, expectedVolatility: 3.5, expectedSharpe: 0.45 },
  moderat:     { expectedReturn: 5.0, expectedVolatility: 8.0, expectedSharpe: 0.50 },
  dinamic:     { expectedReturn: 7.5, expectedVolatility: 13.0, expectedSharpe: 0.48 },
  agressiu:    { expectedReturn: 10.0, expectedVolatility: 18.0, expectedSharpe: 0.45 },
};

function fallback(profile: InvestorProfile, assetIds: string[]): AdapterResult {
  const params = FALLBACK_PARAMS[profile];
  const n = assetIds.length;
  return {
    source: 'profile-model',
    ...params,
    weights: Array(n).fill(1 / n),
    assetIds,
  };
}

// ── Exports per a visualitzacions ─────────────────────────────────────────────

export const PROFILE_ASSET_LABELS: Record<string, string> = {
  'monetari':                  'Monetari',
  'renda-fixa-curta':          'RF Curta',
  'renda-fixa-global':         'RF Global',
  'renda-fixa-europa':         'RF Europa',
  'renda-variable-global':     'RV Global',
  'renda-variable-usa':        'RV USA',
  'renda-variable-europa':     'RV Europa',
  'renda-variable-emergents':  'Emergents',
  'renda-variable-small-caps': 'Small Caps',
  'immobiliari':               'Immobiliari',
  'tecnologia':                'Tecnologia',
  'salut':                     'Salut',
  'energia':                   'Energia',
};

export interface FrontierPoint {
  vol: number;
  ret: number;
  sharpe: number;
}

export interface FrontierData {
  frontier: FrontierPoint[];
  tangency: FrontierPoint & { assetIds: string[]; weights: number[] };
  minVar: FrontierPoint;
}

/** Computes efficient frontier data for a given profile (client-side safe, pure JS). */
export function computeFrontierData(profile: InvestorProfile, rf = RF): FrontierData {
  try {
    const assetIds = PROFILE_ASSETS[profile];
    const constraints = { ...PROFILE_CONSTRAINTS[profile], riskFreeRate: rf };
    const assets: Asset[] = assetIds.map(ac => ({
      id: ac,
      expectedReturn: capmReturn(ac, rf),
      volatility: ASSET_VOLS[ac] ?? 15,
    }));
    const matrix = { correlations: subCorrelationMatrix(assetIds) };
    const result = optimizePortfolio(assets, matrix, constraints);

    const round1 = (n: number) => Math.round(n * 10) / 10;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      frontier: result.efficientFrontier.map(p => ({
        vol:    round1(p.volatility),
        ret:    round1(p.expectedReturn),
        sharpe: round2(p.sharpeRatio),
      })),
      tangency: {
        vol:     round1(result.tangencyPortfolio.volatility),
        ret:     round1(result.tangencyPortfolio.expectedReturn),
        sharpe:  round2(result.tangencyPortfolio.sharpeRatio),
        assetIds,
        weights: result.tangencyPortfolio.weights,
      },
      minVar: {
        vol:    round1(result.minVariancePortfolio.volatility),
        ret:    round1(result.minVariancePortfolio.expectedReturn),
        sharpe: round2(result.minVariancePortfolio.sharpeRatio),
      },
    };
  } catch {
    return {
      frontier: [],
      tangency: { vol: 0, ret: 0, sharpe: 0, assetIds: [], weights: [] },
      minVar:   { vol: 0, ret: 0, sharpe: 0 },
    };
  }
}

/** Returns the correlation submatrix labels and values for the given profile's assets. */
export function getCorrelationData(profile: InvestorProfile): {
  labels: string[];
  matrix: number[][];
} {
  const assetIds = PROFILE_ASSETS[profile];
  return {
    labels: assetIds.map(id => PROFILE_ASSET_LABELS[id] ?? id),
    matrix: subCorrelationMatrix(assetIds),
  };
}

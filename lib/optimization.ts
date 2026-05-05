/**
 * Markowitz Mean-Variance Optimization (MPT)
 *
 * Finds the portfolio on the efficient frontier that maximizes Sharpe ratio
 * (tangency portfolio) or minimizes variance for a given target return.
 *
 * Algorithm: Sequential Quadratic Programming approximated by random search
 * (no external solver dependency) + refinement via gradient descent.
 * Suitable for n ≤ 20 assets and TFG-grade accuracy.
 */

export interface Asset {
  id: string;
  expectedReturn: number;  // annual %
  volatility: number;      // annual %
}

export interface CorrelationMatrix {
  // correlations[i][j] = ρ between asset i and asset j (diagonal = 1)
  correlations: number[][];
}

export interface OptimizationConstraints {
  minWeight?: number;   // default 0 (long-only)
  maxWeight?: number;   // default 1 (no max concentration)
  riskFreeRate?: number; // for Sharpe calculation, default 0
}

export interface PortfolioPoint {
  weights: number[];
  expectedReturn: number;  // %
  volatility: number;      // %
  sharpeRatio: number;
}

export interface OptimizationResult {
  tangencyPortfolio: PortfolioPoint;   // max Sharpe
  minVariancePortfolio: PortfolioPoint; // min vol
  efficientFrontier: PortfolioPoint[]; // 20 points along the frontier
  assets: Asset[];
}

// ── Core math ──────────────────────────────────────────────────────────────

function portfolioReturn(weights: number[], assets: Asset[]): number {
  return weights.reduce((s, w, i) => s + w * assets[i].expectedReturn, 0);
}

function portfolioVariance(
  weights: number[],
  assets: Asset[],
  correlations: number[][],
): number {
  let variance = 0;
  const n = weights.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance +=
        weights[i] *
        weights[j] *
        assets[i].volatility *
        assets[j].volatility *
        correlations[i][j];
    }
  }
  return variance; // % squared
}

function portfolioVolatility(
  weights: number[],
  assets: Asset[],
  correlations: number[][],
): number {
  return Math.sqrt(portfolioVariance(weights, assets, correlations));
}

function sharpe(ret: number, vol: number, rf: number): number {
  if (vol < 1e-8) return 0;
  return (ret - rf) / vol;
}

/** Projects weights onto the simplex [minW, maxW] summing to 1. */
function projectSimplex(
  raw: number[],
  minW: number,
  maxW: number,
): number[] {
  const n = raw.length;
  const clamped = raw.map(w => Math.max(minW, Math.min(maxW, w)));
  const sum = clamped.reduce((s, w) => s + w, 0);
  if (sum === 0) {
    return Array(n).fill(1 / n);
  }
  // Scale to sum = 1
  return clamped.map(w => w / sum);
}

function buildPoint(
  weights: number[],
  assets: Asset[],
  correlations: number[][],
  rf: number,
): PortfolioPoint {
  const ret = portfolioReturn(weights, assets);
  const vol = portfolioVolatility(weights, assets, correlations);
  return { weights: [...weights], expectedReturn: ret, volatility: vol, sharpeRatio: sharpe(ret, vol, rf) };
}

// ── Random search + local refinement ─────────────────────────────────────

const NUM_RANDOM_PORTFOLIOS = 5000;
const REFINEMENT_STEPS = 200;
const STEP_SIZE_INIT = 0.05;

function randomWeights(n: number, minW: number, maxW: number, rng: () => number): number[] {
  const raw = Array.from({ length: n }, () => minW + rng() * (maxW - minW));
  return projectSimplex(raw, minW, maxW);
}

/** Seeded LCG so results are deterministic for the same inputs. */
function makeLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function optimizeForObjective(
  assets: Asset[],
  correlations: number[][],
  constraints: OptimizationConstraints,
  objective: (pt: PortfolioPoint) => number, // maximize this
): PortfolioPoint {
  const n = assets.length;
  const minW = constraints.minWeight ?? 0;
  const maxW = constraints.maxWeight ?? 1;
  const rf = constraints.riskFreeRate ?? 0;
  const rng = makeLcg(42);

  let best: PortfolioPoint | null = null;
  let bestScore = -Infinity;

  for (let trial = 0; trial < NUM_RANDOM_PORTFOLIOS; trial++) {
    const w = randomWeights(n, minW, maxW, rng);
    const pt = buildPoint(w, assets, correlations, rf);
    const score = objective(pt);
    if (score > bestScore) {
      bestScore = score;
      best = pt;
    }
  }

  // Local gradient-free refinement
  let stepSize = STEP_SIZE_INIT;
  for (let step = 0; step < REFINEMENT_STEPS; step++) {
    stepSize *= 0.97;
    let improved = false;
    for (let i = 0; i < n && !improved; i++) {
      for (const sign of [1, -1]) {
        const candidate = [...best!.weights];
        candidate[i] += sign * stepSize;
        const w = projectSimplex(candidate, minW, maxW);
        const pt = buildPoint(w, assets, correlations, rf);
        const score = objective(pt);
        if (score > bestScore + 1e-9) {
          bestScore = score;
          best = pt;
          improved = true;
          break;
        }
      }
    }
  }

  return best!;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Runs Markowitz optimization and returns:
 * - tangency portfolio (max Sharpe)
 * - minimum variance portfolio
 * - 20-point efficient frontier
 */
export function optimizePortfolio(
  assets: Asset[],
  matrix: CorrelationMatrix,
  constraints: OptimizationConstraints = {},
): OptimizationResult {
  if (assets.length < 2) {
    throw new Error('Es necessiten almenys 2 actius per a l\'optimització');
  }
  if (assets.length !== matrix.correlations.length) {
    throw new Error('Dimensions incompatibles: assets vs. matriu de correlació');
  }

  const { correlations } = matrix;
  const rf = constraints.riskFreeRate ?? 0;

  // Tangency portfolio (max Sharpe)
  const tangency = optimizeForObjective(assets, correlations, constraints, pt => pt.sharpeRatio);

  // Min variance portfolio
  const minVar = optimizeForObjective(assets, correlations, constraints, pt => -pt.volatility);

  // Efficient frontier: 20 points from minVar return to max return asset
  const maxPossibleReturn = Math.max(...assets.map(a => a.expectedReturn));
  const minReturn = minVar.expectedReturn;
  const frontier: PortfolioPoint[] = [];
  const steps = 20;

  for (let k = 0; k < steps; k++) {
    const targetReturn = minReturn + ((maxPossibleReturn - minReturn) * k) / (steps - 1);
    // Penalize distance from target return heavily
    const pt = optimizeForObjective(assets, correlations, constraints, p => {
      const penalty = Math.abs(p.expectedReturn - targetReturn) * 100;
      return -p.volatility - penalty;
    });
    frontier.push(pt);
  }

  return {
    tangencyPortfolio: tangency,
    minVariancePortfolio: minVar,
    efficientFrontier: frontier,
    assets,
  };
}

/**
 * Builds a diagonal correlation matrix (no correlations assumed = 1 on diagonal, 0 elsewhere).
 * Useful when historical data is unavailable.
 */
export function identityCorrelationMatrix(n: number): CorrelationMatrix {
  return {
    correlations: Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    ),
  };
}

/**
 * Computes a correlation matrix from arrays of period returns (same length).
 */
export function computeCorrelationMatrix(returnSeries: number[][]): CorrelationMatrix {
  const n = returnSeries.length;
  const means = returnSeries.map(s => s.reduce((a, b) => a + b, 0) / s.length);
  const stds = returnSeries.map((s, i) => {
    const m = means[i];
    return Math.sqrt(s.reduce((a, r) => a + (r - m) ** 2, 0) / s.length) || 1e-10;
  });

  const correlations: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const len = Math.min(...returnSeries.map(s => s.length));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        correlations[i][j] = 1;
      } else {
        let cov = 0;
        for (let t = 0; t < len; t++) {
          cov += (returnSeries[i][t] - means[i]) * (returnSeries[j][t] - means[j]);
        }
        cov /= len;
        const rho = Math.max(-1, Math.min(1, cov / (stds[i] * stds[j])));
        correlations[i][j] = rho;
        correlations[j][i] = rho;
      }
    }
  }

  return { correlations };
}

import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from '@/lib/monteCarlo';
import { expectNear, gbmMedian } from '../helpers/financialAssertions';

// ── Paràmetres de referència ───────────────────────────────────────────────

const BASE_PARAMS = {
  initialInvestment:   10_000,
  monthlyContribution: 0,        // sense aportacions → cas analític pur
  investmentHorizon:   10,
  annualReturn:        7,        // 7% anual
  annualVolatility:    15,       // 15% vol
  inflationRate:       0,        // sense inflació per simplificar
  numSimulations:      3000,     // prou per convergir
};

// ── Convergència a la solució analítica de GBM ────────────────────────────

describe('runMonteCarlo — convergència GBM (Ito\'s lemma)', () => {
  it('P50 ≈ S0 × exp((μ - σ²/2) × T) amb ±10% de tolerància', () => {
    const result = runMonteCarlo(BASE_PARAMS);
    const analytical = gbmMedian(
      BASE_PARAMS.initialInvestment,
      BASE_PARAMS.annualReturn,
      BASE_PARAMS.annualVolatility,
      BASE_PARAMS.investmentHorizon,
    );
    const simulatedP50 = result.percentiles.p50;
    expectNear(simulatedP50, analytical, 10, 'P50 vs. GBM analític');
  });

  it('P50 > P25 > P10 — ordre de percentils correcte', () => {
    const result = runMonteCarlo(BASE_PARAMS);
    const p = result.percentiles;
    expect(p.p90).toBeGreaterThan(p.p75);
    expect(p.p75).toBeGreaterThan(p.p50);
    expect(p.p50).toBeGreaterThan(p.p25);
    expect(p.p25).toBeGreaterThan(p.p10);
  });

  it('P10 > 0 per a parametres raonables (no pot perdre més del 100%)', () => {
    const result = runMonteCarlo(BASE_PARAMS);
    expect(result.percentiles.p10).toBeGreaterThan(0);
  });
});

// ── Propietats financeres bàsiques ────────────────────────────────────────

describe('runMonteCarlo — propietats', () => {
  it('retorn positiu esperat → P50 > inversió inicial', () => {
    const result = runMonteCarlo(BASE_PARAMS);
    expect(result.percentiles.p50).toBeGreaterThan(BASE_PARAMS.initialInvestment);
  });

  it('rendiment esperat més alt → P50 final més alt', () => {
    const low  = runMonteCarlo({ ...BASE_PARAMS, annualReturn: 3, numSimulations: 1000 });
    const high = runMonteCarlo({ ...BASE_PARAMS, annualReturn: 10, numSimulations: 1000 });
    expect(high.percentiles.p50).toBeGreaterThan(low.percentiles.p50);
  });

  it('aportació mensual positiva → P50 final > sense aportació', () => {
    const sense = runMonteCarlo({ ...BASE_PARAMS, numSimulations: 1000 });
    const amb   = runMonteCarlo({ ...BASE_PARAMS, monthlyContribution: 500, numSimulations: 1000 });
    expect(amb.percentiles.p50).toBeGreaterThan(sense.percentiles.p50);
  });

  it('horitzó més llarg → P50 final més alt (rendiment positiu)', () => {
    const curt  = runMonteCarlo({ ...BASE_PARAMS, investmentHorizon: 5,  numSimulations: 1000 });
    const llarg = runMonteCarlo({ ...BASE_PARAMS, investmentHorizon: 20, numSimulations: 1000 });
    expect(llarg.percentiles.p50).toBeGreaterThan(curt.percentiles.p50);
  });

  it('probabilitats entre 0 i 100', () => {
    const result = runMonteCarlo(BASE_PARAMS);
    const p = result.probabilityAnalysis;
    expect(p.probabilityPositiveReturn).toBeGreaterThanOrEqual(0);
    expect(p.probabilityPositiveReturn).toBeLessThanOrEqual(100);
    expect(p.probabilityBeatInflation).toBeGreaterThanOrEqual(0);
    expect(p.probabilityBeatInflation).toBeLessThanOrEqual(100);
  });

  it('alta vol → P90/P10 spread major que amb baixa vol', () => {
    const quieta  = runMonteCarlo({ ...BASE_PARAMS, annualVolatility: 5,  numSimulations: 1000 });
    const volàtil = runMonteCarlo({ ...BASE_PARAMS, annualVolatility: 30, numSimulations: 1000 });
    const spreadQuieta  = quieta.percentiles.p90  - quieta.percentiles.p10;
    const spreadVolàtil = volàtil.percentiles.p90 - volàtil.percentiles.p10;
    expect(spreadVolàtil).toBeGreaterThan(spreadQuieta);
  });

  it('projectionData té tants anys com investmentHorizon', () => {
    const result = runMonteCarlo(BASE_PARAMS);
    expect(result.projectionData).toHaveLength(BASE_PARAMS.investmentHorizon);
  });
});

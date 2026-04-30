'use client';
// hooks/usePortfolio.ts
// Hook per gestionar el cicle de vida de la cartera recomanada

import { useState, useCallback, useRef } from 'react';
import { buildPortfolio, Portfolio } from '@/lib/portfolio';
import { calculateScore, InvestorQuestionnaire, ScoringResult } from '@/lib/scoring';
import { calculatePortfolioMetrics, PortfolioMetrics, generateSimulatedHistoricalData, HistoricalChartPoint, HistoricalSeries } from '@/lib/metrics';
import { runPortfolioMonteCarlo, MonteCarloResult } from '@/lib/monteCarlo';
import { buildScenarioAnalysis, ScenarioAnalysis } from '@/lib/monteCarlo';

export type PortfolioStatus = 'idle' | 'scoring' | 'building' | 'fetching-data' | 'calculating' | 'done' | 'error';

export interface PortfolioState {
  status:           PortfolioStatus;
  scoring:          ScoringResult | null;
  portfolio:        Portfolio | null;
  metrics:          PortfolioMetrics | null;
  monteCarlo:       MonteCarloResult | null;
  scenarios:        ScenarioAnalysis | null;
  historicalData:   HistoricalChartPoint[];
  error:            string | null;
  processingTime:   number;
}

const INITIAL_STATE: PortfolioState = {
  status:          'idle',
  scoring:         null,
  portfolio:       null,
  metrics:         null,
  monteCarlo:      null,
  scenarios:       null,
  historicalData:  [],
  error:           null,
  processingTime:  0,
};

export function usePortfolio() {
  const [state, setState] = useState<PortfolioState>(INITIAL_STATE);
  const startTimeRef      = useRef<number>(0);

  const generatePortfolio = useCallback(async (
    questionnaire: InvestorQuestionnaire
  ) => {
    startTimeRef.current = Date.now();
    setState(s => ({ ...s, status: 'scoring', error: null }));

    try {
      // ── 1. Scoring ────────────────────────────────────────────────────────
      const scoring = calculateScore(questionnaire);
      setState(s => ({ ...s, scoring, status: 'building' }));

      // ── 2. Construir cartera ───────────────────────────────────────────────
      await tick();
      const portfolio = buildPortfolio(scoring.profile, questionnaire);
      setState(s => ({ ...s, portfolio, status: 'fetching-data' }));

      // ── 3. Intentar obtenir dades de mercat (server-side) ─────────────────
      await tick();
      let historicalMap: Map<string, HistoricalSeries> | undefined;
      try {
        const dataRes = await fetchMarketDataForPortfolio(portfolio);
        historicalMap = dataRes;
      } catch {
        // Continua sense dades reals
      }
      setState(s => ({ ...s, status: 'calculating' }));

      // ── 4. Calcular mètriques ──────────────────────────────────────────────
      await tick();
      const metrics   = calculatePortfolioMetrics(portfolio, historicalMap);
      const historical = generateSimulatedHistoricalData(portfolio, 5);

      // ── 5. Monte Carlo ────────────────────────────────────────────────────
      await tick();
      const monteCarlo = runPortfolioMonteCarlo(portfolio, {
        initialInvestment:   questionnaire.initialInvestment,
        monthlyContribution: questionnaire.monthlyContribution,
        investmentHorizon:   questionnaire.investmentHorizon,
        targetAmount:        questionnaire.targetAmount,
      });

      // ── 6. Escenaris ──────────────────────────────────────────────────────
      const scenarios = buildScenarioAnalysis(
        portfolio,
        questionnaire.initialInvestment,
        questionnaire.monthlyContribution,
        questionnaire.investmentHorizon
      );

      const processingTime = Date.now() - startTimeRef.current;

      setState({
        status: 'done',
        scoring,
        portfolio,
        metrics,
        monteCarlo,
        scenarios,
        historicalData: historical,
        error: null,
        processingTime,
      });

    } catch (err) {
      setState(s => ({
        ...s,
        status: 'error',
        error:  err instanceof Error ? err.message : 'Error desconegut generant la cartera.',
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return { state, generatePortfolio, reset };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 10));
}

async function fetchMarketDataForPortfolio(
  portfolio: Portfolio
): Promise<Map<string, HistoricalSeries>> {
  const map = new Map<string, HistoricalSeries>();

  const requests = portfolio.allocations
    .filter(a => a.product.dataIdentifier)
    .map(async a => {
      try {
        const res = await fetch(
          `/api/market-data?ticker=${encodeURIComponent(a.product.dataIdentifier!)}&period=5y`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.prices?.length > 12) {
          const rawPrices: { date: string; close: number; adjustedClose?: number }[] = data.prices;
          const prices = rawPrices.map((p, i) => ({
            date:   p.date,
            price:  p.adjustedClose ?? p.close,
            return: i > 0
              ? (((p.adjustedClose ?? p.close) - (rawPrices[i - 1].adjustedClose ?? rawPrices[i - 1].close)) /
                  (rawPrices[i - 1].adjustedClose ?? rawPrices[i - 1].close)) * 100
              : 0,
          }));
          const returns = prices.slice(1).map(p => p.return);
          map.set(a.productId, {
            productId: a.productId,
            currency:  a.product.currency ?? 'EUR',
            prices,
            returns,
            status: 'real',
          });
        }
      } catch { /* silenci */ }
    });

  await Promise.allSettled(requests);
  return map;
}

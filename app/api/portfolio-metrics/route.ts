// app/api/portfolio-metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Portfolio }         from '@/lib/portfolio';
import { ScoringResult }     from '@/lib/scoring';
import { calculatePortfolioMetrics } from '@/lib/metrics';
import { runPortfolioMonteCarlo }    from '@/lib/monteCarlo';
import { generateReport }            from '@/lib/report';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface MetricsRequest {
  portfolio:     Portfolio;
  scoring:       ScoringResult;
  questionnaire: {
    clientName?:          string;
    clientEmail?:         string;
    initialInvestment:    number;
    monthlyContribution:  number;
    investmentHorizon:    number;
    targetAmount:         number;
    currentSavings:       number;
    percentageToInvest:   number;
    annualIncome:         number;
    monthlyExpenses:      number;
    netWorth:             number;
    totalDebt:            number;
    financialGoal:        string;
    financialKnowledge:   string;
    investmentExperience: string;
    lossTolerance:        string;
    reactionToDrops:      string;
    esgPreference:        string;
    liquidityNeed:        string;
    age:                  number;
    worstAcceptableLoss:  number;
  };
  options?: {
    includeReport?:     boolean;
    includeMonteCarlo?: boolean;
    numSimulations?:    number;
  };
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as MetricsRequest;
    const { portfolio, scoring, questionnaire, options = {} } = body;

    // Validació bàsica
    if (!portfolio || !scoring || !questionnaire) {
      return NextResponse.json(
        { error: 'portfolio, scoring i questionnaire són obligatoris.' },
        { status: 400 }
      );
    }

    // ── Mètriques de la cartera ───────────────────────────────────────────────
    // Sense dades reals de moment (s'obtenen via backtest separat)
    const metrics = calculatePortfolioMetrics(portfolio);

    // ── Monte Carlo ───────────────────────────────────────────────────────────
    let monteCarlo = null;
    if (options.includeMonteCarlo !== false) {
      monteCarlo = runPortfolioMonteCarlo(portfolio, {
        initialInvestment:   questionnaire.initialInvestment,
        monthlyContribution: questionnaire.monthlyContribution,
        investmentHorizon:   questionnaire.investmentHorizon,
        targetAmount:        questionnaire.targetAmount,
      });
    }

    // ── Informe ───────────────────────────────────────────────────────────────
    let report = null;
    if (options.includeReport && monteCarlo) {
      // Reconstruïm el questionnaire complet
      const fullQuestionnaire = {
        clientName:           questionnaire.clientName ?? 'Client',
        clientEmail:          questionnaire.clientEmail,
        age:                  questionnaire.age,
        annualIncome:         questionnaire.annualIncome,
        monthlyExpenses:      questionnaire.monthlyExpenses,
        currentSavings:       questionnaire.currentSavings,
        netWorth:             questionnaire.netWorth,
        totalDebt:            questionnaire.totalDebt,
        financialGoal:        questionnaire.financialGoal as never,
        investmentHorizon:    questionnaire.investmentHorizon,
        targetAmount:         questionnaire.targetAmount,
        initialInvestment:    questionnaire.initialInvestment,
        monthlyContribution:  questionnaire.monthlyContribution,
        percentageToInvest:   questionnaire.percentageToInvest,
        financialKnowledge:   questionnaire.financialKnowledge as never,
        investmentExperience: questionnaire.investmentExperience as never,
        lossTolerance:        questionnaire.lossTolerance as never,
        reactionToDrops:      questionnaire.reactionToDrops as never,
        worstAcceptableLoss:  questionnaire.worstAcceptableLoss,
        esgPreference:        questionnaire.esgPreference as never,
        liquidityNeed:        questionnaire.liquidityNeed as never,
        incomeStability:      (questionnaire as Record<string, unknown>).incomeStability  as never ?? 'estable',
        crisisExperience:     (questionnaire as Record<string, unknown>).crisisExperience as never ?? 'no-vaig-invertir',
      };

      report = generateReport(
        fullQuestionnaire,
        scoring,
        portfolio,
        metrics,
        monteCarlo
      );
    }

    // ── Resposta ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      metrics,
      monteCarlo,
      report,
      generatedAt: new Date().toISOString(),
      status:      'success',
    });

  } catch (error) {
    console.error('[portfolio-metrics] Error:', error);
    return NextResponse.json(
      {
        error:   'Error intern del servidor calculant les mètriques.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Suport GET per health-check
export async function GET() {
  return NextResponse.json({
    status:    'ok',
    endpoint:  '/api/portfolio-metrics',
    methods:   ['POST'],
    version:   '2.0',
    timestamp: new Date().toISOString(),
  });
}
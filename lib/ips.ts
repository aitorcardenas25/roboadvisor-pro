/**
 * Investment Policy Statement (IPS) generator.
 * Produces a structured document summarising the client's objectives,
 * constraints, and assigned portfolio. Used for MiFID II documentation.
 */

import type { InvestorQuestionnaire } from './scoring';
import type { ScoringResult } from './scoring';
import type { Portfolio } from './portfolio';

export interface IPSSection {
  title:   string;
  content: string;
}

export interface InvestmentPolicyStatement {
  version:     string;
  generatedAt: string;
  clientName:  string;
  sections:    IPSSection[];
}

const EUR = new Intl.NumberFormat('ca-ES', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});

export function generateIPS(
  questionnaire: InvestorQuestionnaire,
  scoring: ScoringResult,
  portfolio: Portfolio,
): InvestmentPolicyStatement {
  const investable = questionnaire.currentSavings * (questionnaire.percentageToInvest / 100);

  const sections: IPSSection[] = [
    {
      title: '1. Objectiu d\'inversió',
      content:
        `L'objectiu principal és ${goalLabel(questionnaire.financialGoal)} amb un ` +
        `horitzó temporal de ${questionnaire.investmentHorizon} anys i un import objectiu de ` +
        `${EUR.format(questionnaire.targetAmount)}.`,
    },
    {
      title: '2. Perfil de risc (MiFID II Art. 54)',
      content:
        `Perfil assignat: ${profileLabel(scoring.profile)} ` +
        `(puntuació: ${scoring.scorePercentage}/100, ${scoring.totalScore}/${scoring.maxScore} pts). ` +
        `El client ${toleranceText(questionnaire)}. ` +
        `Experiència inversora: ${experienceLabel(questionnaire.investmentExperience)}. ` +
        `Coneixement financer: ${questionnaire.financialKnowledge}.`,
    },
    {
      title: '3. Situació financera',
      content:
        `Ingressos anuals: ${EUR.format(questionnaire.annualIncome)}. ` +
        `Despeses mensuals: ${EUR.format(questionnaire.monthlyExpenses)}. ` +
        `Estalvis actuals: ${EUR.format(questionnaire.currentSavings)}. ` +
        `Deute total: ${EUR.format(questionnaire.totalDebt)}. ` +
        `Taxa d'estalvi: ${scoring.diagnostics.savingsRate.toFixed(1)}%. ` +
        `Fons d'emergència: ${scoring.diagnostics.emergencyFundMonths.toFixed(1)} mesos de despeses.`,
    },
    {
      title: '4. Paràmetres de la cartera',
      content:
        `Import a invertir: ${EUR.format(investable)} (${questionnaire.percentageToInvest}% dels estalvis). ` +
        `Aportació mensual: ${EUR.format(questionnaire.monthlyContribution)}. ` +
        `Rendibilitat esperada: ${portfolio.expectedReturn}% anual. ` +
        `Volatilitat esperada: ${portfolio.expectedVolatility}% anual. ` +
        `Sharpe estimat: ${portfolio.expectedSharpe.toFixed(2)}. ` +
        `Metodologia: ${portfolio.optimizationSource === 'mpt-optimized'
          ? 'Markowitz Mean-Variance Optimization (MPT)'
          : 'Model base per perfil'}.`,
    },
    {
      title: '5. Restriccions i preferències',
      content: buildConstraintsText(questionnaire),
    },
    {
      title: '6. Cartera assignada',
      content:
        `${portfolio.name} — ${portfolio.allocations.length} posicions. ` +
        `TER total ponderat: ${portfolio.totalTER.toFixed(2)}% anual. ` +
        `Score ESG: ${portfolio.esgScore}/100. ` +
        `Benchmark de referència: ${portfolio.benchmark.name}. ` +
        `Màxim drawdown estimat: ${portfolio.maxDrawdownEstimate}%.`,
    },
    {
      title: '7. Revisió i actualització',
      content:
        'Aquest IPS s\'ha de revisar anualment o davant de canvis significatius en la situació ' +
        'financera o objectius del client. Qualsevol modificació de la cartera requereix un nou ' +
        'suitability assessment conforme a MiFID II.',
    },
    {
      title: '8. Disclaimer legal',
      content:
        'Document d\'ús intern. No constitueix assessorament d\'inversió regulat per la CNMV. ' +
        'Les rendibilitats passades no garanteixen rendibilitats futures. ' +
        'La inversió en mercats financers comporta risc de pèrdua parcial o total del capital invertit.',
    },
  ];

  return {
    version:     '1.0',
    generatedAt: new Date().toISOString(),
    clientName:  questionnaire.clientName || 'Client',
    sections,
  };
}

// ── Helpers de text ───────────────────────────────────────────────────────────

function goalLabel(goal: string): string {
  const m: Record<string, string> = {
    'preservacio-capital':  'preservar el capital',
    'ingressos-regulars':   'generar ingressos regulars',
    'creixement-moderat':   'creixement moderat del patrimoni',
    'creixement-agresiu':   'creixement agressiu del patrimoni',
    'maxima-rendibilitat':  'maximitzar la rendibilitat a llarg termini',
    'jubilacio':            'planificació de la jubilació',
    'compra-habitatge':     'finançament de compra d\'habitatge',
    'educacio':             'finançament d\'educació',
  };
  return m[goal] ?? goal;
}

function profileLabel(p: string): string {
  const m: Record<string, string> = {
    'conservador': 'Conservador', 'moderat': 'Moderat',
    'dinamic': 'Dinàmic',        'agressiu': 'Agressiu',
  };
  return m[p] ?? p;
}

function toleranceText(q: InvestorQuestionnaire): string {
  const m: Record<string, string> = {
    'no-accepto-perdues': 'no accepta pèrdues',
    'fins-5':  'accepta pèrdues de fins al 5%',
    'fins-10': 'accepta pèrdues de fins al 10%',
    'fins-20': 'accepta pèrdues de fins al 20%',
    'fins-30': 'accepta pèrdues de fins al 30%',
    'mes-30':  'accepta pèrdues superiors al 30%',
  };
  return m[q.lossTolerance] ?? `accepta una pèrdua màxima del ${q.worstAcceptableLoss}%`;
}

function experienceLabel(exp: string): string {
  const m: Record<string, string> = {
    'menys-1-any':  'menys d\'1 any',
    '1-3-anys':     '1–3 anys',
    '3-5-anys':     '3–5 anys',
    'mes-5-anys':   'més de 5 anys',
  };
  return m[exp] ?? exp;
}

function buildConstraintsText(q: InvestorQuestionnaire): string {
  const parts: string[] = [];

  if (q.esgPreference !== 'no-importa') {
    const esgM: Record<string, string> = {
      'important':  'preferència ESG important',
      'essencial':  'criteris ESG essencials — filtre prioritari',
      'no-importa': '',
    };
    parts.push(esgM[q.esgPreference] ?? q.esgPreference);
  }

  const liquidityM: Record<string, string> = {
    'necessito-ja':    'necessitat de liquiditat immediata',
    'potser-6-mesos':  'possible disposició en 6 mesos',
    'potser-1-any':    'possible disposició en 1 any',
    'potser-3-anys':   'possible disposició en 3 anys',
    'no-necessito':    'sense necessitat de liquiditat prevista',
  };
  parts.push(liquidityM[q.liquidityNeed] ?? q.liquidityNeed);

  const incomeM: Record<string, string> = {
    'estable':             'ingressos estables',
    'variable':            'ingressos variables',
    'molt-variable':       'ingressos molt variables',
    'sense-ingressos':     'sense ingressos regulars',
  };
  parts.push(incomeM[q.incomeStability] ?? q.incomeStability);

  if (parts.filter(Boolean).length === 0) return 'Sense restriccions específiques declarades.';
  return parts.filter(Boolean).join('. ') + '.';
}

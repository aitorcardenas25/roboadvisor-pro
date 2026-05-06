// lib/report.ts
// Generació de l'informe financer professional

import { InvestorProfile } from './products';
import { ScoringResult, InvestorQuestionnaire, getProfileLabel, getProfileDescription } from './scoring';
import { Portfolio, CompositeBenchmark } from './portfolio';
import { PortfolioMetrics } from './metrics';
import { MonteCarloResult } from './monteCarlo';
import { generateIPS, InvestmentPolicyStatement } from './ips';
import { checkMiFIDSuitability, SuitabilityReport } from './suitability';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface FinancialReport {
  metadata:        ReportMetadata;
  executiveSummary: ExecutiveSummary;
  investorProfile: InvestorProfileSection;
  financialDiagnostics: DiagnosticsSection;
  ipsSection:      InvestmentPolicyStatement;
  suitabilitySection: SuitabilityReport;
  portfolioSection: PortfolioSection;
  benchmarkSection: BenchmarkSection;
  metricsSection:  MetricsSection;
  monteCarloSection: MonteCarloSection;
  costsSection:    CostsSection;
  dataSection:     DataSection;
  risksSection:    RisksSection;
  conclusionSection: ConclusionSection;
  legalDisclaimer: string;
}

export type { InvestmentPolicyStatement, SuitabilityReport };

export interface ReportMetadata {
  reportId:        string;
  generatedAt:     string;
  generatedDate:   string;
  version:         string;
  clientName?:     string;
  advisorNote:     string;
}

export interface ExecutiveSummary {
  headline:        string;
  profileLabel:    string;
  profileIcon:     string;
  scorePercentage: number;
  keyPoints:       string[];
  alertPoints:     string[];
  investableAmount: number;
  targetAmount:    number;
  horizon:         number;
  feasibility:     'alta' | 'moderada' | 'baixa' | 'molt-baixa';
  feasibilityNote: string;
}

export interface InvestorProfileSection {
  profile:         InvestorProfile;
  label:           string;
  description:     string;
  scoreBreakdown:  ScoreItem[];
  strengths:       string[];
  warnings:        string[];
  radarData:       RadarDataPoint[];
}

export interface ScoreItem {
  dimension:   string;
  score:       number;
  maxScore:    number;
  percentage:  number;
  label:       string;
}

export interface RadarDataPoint {
  dimension: string;
  value:     number;
  fullMark:  number;
}

export interface DiagnosticsSection {
  savingsRate:           number;
  debtToIncomeRatio:     number;
  emergencyFundMonths:   number;
  netWorthToIncomeRatio: number;
  investableAmount:      number;
  feasibilityScore:      number;
  diagnosticItems:       DiagnosticItem[];
}

export interface DiagnosticItem {
  label:       string;
  value:       string;
  status:      'good' | 'warning' | 'alert' | 'neutral';
  explanation: string;
}

export interface PortfolioSection {
  name:              string;
  description:       string;
  allocations:       AllocationItem[];
  assetAllocation:   AssetAllocationItem[];
  characteristics:   string[];
  selectionCriteria: string[];
}

export interface AllocationItem {
  name:        string;
  isin:        string;
  manager:     string;
  weight:      number;
  amount:      number;
  assetClass:  string;
  ter:         number;
  risk:        number;
  rationale:   string;
  dataStatus:  string;
}

export interface AssetAllocationItem {
  category: string;
  weight:   number;
  color:    string;
}

export interface BenchmarkSection {
  name:        string;
  description: string;
  components:  BenchmarkComponentItem[];
  rationale:   string;
  comparisonNote: string;
}

export interface BenchmarkComponentItem {
  index:       string;
  weight:      number;
  description: string;
}

export interface MetricsSection {
  status:              string;
  statusColor:         string;
  annualizedReturn:    MetricItem;
  annualizedVolatility: MetricItem;
  sharpeRatio:         MetricItem;
  sortinoRatio:        MetricItem;
  maxDrawdown:         MetricItem;
  calmarRatio:         MetricItem;
  beta:                MetricItem;
  trackingError:       MetricItem;
  interpretation:      string;
  rollingReturns:      RollingReturnItem[];
  riskContributions:   RiskContributionItem[];
}

export interface MetricItem {
  value:       number;
  formatted:   string;
  label:       string;
  explanation: string;
  status:      'good' | 'neutral' | 'warning';
}

export interface RollingReturnItem {
  period:           string;
  portfolioReturn:  number;
  benchmarkReturn:  number;
  excess:           number;
  statusLabel:      string;
}

export interface RiskContributionItem {
  productName:      string;
  weight:           number;
  riskContribution: number;
  marginalRisk:     number;
}

export interface MonteCarloSection {
  numSimulations:  number;
  horizon:         number;
  p10:             number;
  p50:             number;
  p90:             number;
  totalInvested:   number;
  medianGain:      number;
  medianGainPct:   number;
  probPositive:    number;
  probBeatInflation: number;
  probReachTarget: number;
  targetAmount:    number;
  realValue:       number;
  inflationRate:   number;
  scenarioNote:    string;
  interpretation:  string;
}

export interface CostsSection {
  totalTER:        number;
  totalTERAmount:  number;
  costItems:       CostItem[];
  costComparison:  CostComparison;
  costNote:        string;
}

export interface CostItem {
  productName: string;
  weight:      number;
  ter:         number;
  weightedCost: number;
  managementType: string;
}

export interface CostComparison {
  activeFundsAvgTER:  number;
  indexFundsAvgTER:   number;
  portfolioTER:       number;
  savingsVsActive:    number;
  note:               string;
}

export interface DataSection {
  overallStatus:  string;
  sources:        DataSourceItem[];
  disclaimer:     string;
  lastUpdated:    string;
}

export interface DataSourceItem {
  name:    string;
  status:  string;
  color:   string;
  count:   number;
}

export interface RisksSection {
  mainRisks:       RiskItem[];
  mitigants:       string[];
  followUpPlan:    string[];
}

export interface RiskItem {
  category:    string;
  description: string;
  level:       'baix' | 'moderat' | 'alt' | 'molt-alt';
  mitigation:  string;
}

export interface ConclusionSection {
  summary:         string;
  nextSteps:       string[];
  reviewDate:      string;
  reviewFrequency: string;
}

// ─── REPORT GENERATOR ─────────────────────────────────────────────────────────

export function generateReport(
  questionnaire: InvestorQuestionnaire,
  scoring:       ScoringResult,
  portfolio:     Portfolio,
  metrics:       PortfolioMetrics,
  monteCarlo:    MonteCarloResult
): FinancialReport {

  return {
    metadata:             buildMetadata(),
    executiveSummary:     buildExecutiveSummary(questionnaire, scoring, portfolio, monteCarlo),
    investorProfile:      buildInvestorProfile(scoring),
    financialDiagnostics: buildDiagnostics(scoring, questionnaire),
    ipsSection:           generateIPS(questionnaire, scoring, portfolio),
    suitabilitySection:   checkMiFIDSuitability(scoring.profile, questionnaire, portfolio.allocations),
    portfolioSection:     buildPortfolioSection(portfolio),
    benchmarkSection:     buildBenchmarkSection(portfolio),
    metricsSection:       buildMetricsSection(metrics, portfolio),
    monteCarloSection:    buildMonteCarloSection(monteCarlo, questionnaire),
    costsSection:         buildCostsSection(portfolio, questionnaire),
    dataSection:          buildDataSection(portfolio),
    risksSection:         buildRisksSection(portfolio, scoring),
    conclusionSection:    buildConclusionSection(portfolio, questionnaire),
    legalDisclaimer:      LEGAL_DISCLAIMER,
  };
}

// ─── METADATA ─────────────────────────────────────────────────────────────────

function buildMetadata(): ReportMetadata {
  const now  = new Date();
  const date = now.toLocaleDateString('ca-ES', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  return {
    reportId:      `RA-${Date.now().toString(36).toUpperCase()}`,
    generatedAt:   now.toISOString(),
    generatedDate: date,
    version:       '2.0',
    advisorNote:   'Informe generat automàticament pel sistema RoboAdvisor Pro. Eina de suport a la decisió d\'inversió.',
  };
}

// ─── EXECUTIVE SUMMARY ────────────────────────────────────────────────────────

function buildExecutiveSummary(
  q:       InvestorQuestionnaire,
  scoring: ScoringResult,
  portfolio: Portfolio,
  mc:      MonteCarloResult
): ExecutiveSummary {

  const investableAmount = q.currentSavings * (q.percentageToInvest / 100);
  const feasibility      = getFeasibility(scoring.diagnostics.feasibilityScore);

  const keyPoints: string[] = [
    `Perfil inversor: ${getProfileLabel(scoring.profile)} (${scoring.scorePercentage}% de puntuació)`,
    `Import a invertir: ${formatCurrency(investableAmount)} (${q.percentageToInvest}% dels estalvis)`,
    `Horitzó temporal: ${q.investmentHorizon} anys`,
    `Cartera recomanada: ${portfolio.name}`,
    `Rendibilitat esperada: ${portfolio.expectedReturn}% anual estimat`,
    `Volatilitat esperada: ${portfolio.expectedVolatility}% anual estimat`,
    `Cost total (TER ponderat): ${portfolio.totalTER.toFixed(2)}% anual`,
    `Mediana Monte Carlo (${q.investmentHorizon}a): ${formatCurrency(mc.percentiles.p50)}`,
  ];

  const alertPoints: string[] = [
    ...scoring.warnings,
  ];

  if (mc.summary.probabilityOfLoss > 20) {
    alertPoints.push(`Probabilitat de pèrdua estimada: ${mc.summary.probabilityOfLoss}%. Considera el teu horitzó temporal.`);
  }

  return {
    headline:        `Proposta d'inversió personalitzada — ${getProfileLabel(scoring.profile)}`,
    profileLabel:    getProfileLabel(scoring.profile),
    profileIcon:     getProfileIconEmoji(scoring.profile),
    scorePercentage: scoring.scorePercentage,
    keyPoints,
    alertPoints,
    investableAmount,
    targetAmount:    q.targetAmount,
    horizon:         q.investmentHorizon,
    feasibility,
    feasibilityNote: buildFeasibilityNote(feasibility, mc),
  };
}

// ─── INVESTOR PROFILE ─────────────────────────────────────────────────────────

function buildInvestorProfile(scoring: ScoringResult): InvestorProfileSection {
  const { breakdown } = scoring;

  const scoreBreakdown: ScoreItem[] = [
    { dimension: 'Horitzó temporal',      score: breakdown.horizonScore,       maxScore: 20, percentage: pct(breakdown.horizonScore, 20),       label: 'Anys disponibles per invertir' },
    { dimension: 'Coneixement financer',  score: breakdown.knowledgeScore,     maxScore: 15, percentage: pct(breakdown.knowledgeScore, 15),     label: 'Nivell de formació financera' },
    { dimension: 'Experiència inversora', score: breakdown.experienceScore,    maxScore: 15, percentage: pct(breakdown.experienceScore, 15),    label: 'Anys d\'experiència en inversions' },
    { dimension: 'Tolerància a pèrdues', score: breakdown.toleranceScore,     maxScore: 20, percentage: pct(breakdown.toleranceScore, 20),     label: 'Pèrdua màxima acceptable' },
    { dimension: 'Reacció davant caigudes', score: breakdown.reactionScore,   maxScore: 15, percentage: pct(breakdown.reactionScore, 15),      label: 'Comportament en mercats baixistes' },
    { dimension: 'Objectiu financer',     score: breakdown.goalScore,          maxScore: 10, percentage: pct(breakdown.goalScore, 10),          label: 'Objectiu i motivació de la inversió' },
    { dimension: 'Necessitat de liquiditat', score: breakdown.liquidityScore, maxScore: 10, percentage: pct(breakdown.liquidityScore, 10),     label: 'Disponibilitat del capital' },
    { dimension: 'Salut financera',       score: breakdown.financialHealthScore, maxScore: 10, percentage: pct(breakdown.financialHealthScore, 10), label: 'Diagnòstic de la situació financera' },
  ];

  const radarData: RadarDataPoint[] = scoreBreakdown.map(item => ({
    dimension: item.dimension,
    value:     item.percentage,
    fullMark:  100,
  }));

  return {
    profile:        scoring.profile,
    label:          getProfileLabel(scoring.profile),
    description:    getProfileDescription(scoring.profile),
    scoreBreakdown,
    strengths:      scoring.strengths,
    warnings:       scoring.warnings,
    radarData,
  };
}

// ─── DIAGNOSTICS ──────────────────────────────────────────────────────────────

function buildDiagnostics(
  scoring: ScoringResult,
  q:       InvestorQuestionnaire
): DiagnosticsSection {
  const d = scoring.diagnostics;

  const diagnosticItems: DiagnosticItem[] = [
    {
      label:       'Taxa d\'estalvi',
      value:       `${d.savingsRate.toFixed(1)}%`,
      status:      d.savingsRate >= 20 ? 'good' : d.savingsRate >= 10 ? 'warning' : 'alert',
      explanation: d.savingsRate >= 20
        ? 'Excel·lent capacitat d\'estalvi. Base sòlida per a la inversió.'
        : d.savingsRate >= 10
        ? 'Taxa d\'estalvi acceptable. Considera incrementar-la per accelerar els objectius.'
        : 'Taxa d\'estalvi insuficient. Prioritza reduir despeses per crear marge d\'inversió.',
    },
    {
      label:       'Fons d\'emergència',
      value:       `${d.emergencyFundMonths.toFixed(1)} mesos`,
      status:      d.emergencyFundMonths >= 6 ? 'good' : d.emergencyFundMonths >= 3 ? 'warning' : 'alert',
      explanation: d.emergencyFundMonths >= 6
        ? 'Fons d\'emergència suficient. Pots invertir amb tranquil·litat.'
        : d.emergencyFundMonths >= 3
        ? 'Fons d\'emergència acceptable. Considera reforçar-lo fins a 6 mesos.'
        : 'Fons d\'emergència insuficient. Prioritza crear-lo abans d\'invertir.',
    },
    {
      label:       'Ràtio deute/ingressos',
      value:       `${d.debtToIncomeRatio.toFixed(1)}%`,
      status:      d.debtToIncomeRatio <= 15 ? 'good' : d.debtToIncomeRatio <= 35 ? 'warning' : 'alert',
      explanation: d.debtToIncomeRatio <= 15
        ? 'Nivell de deute molt baix. Situació financera sòlida.'
        : d.debtToIncomeRatio <= 35
        ? 'Nivell de deute moderat. Gestiona\'l paral·lelament a la inversió.'
        : 'Nivell de deute elevat. Considera prioritzar la reducció del deute.',
    },
    {
      label:       'Patrimoni net / Ingressos',
      value:       `${d.netWorthToIncomeRatio.toFixed(1)}x`,
      status:      d.netWorthToIncomeRatio >= 3 ? 'good' : d.netWorthToIncomeRatio >= 1 ? 'neutral' : 'warning',
      explanation: d.netWorthToIncomeRatio >= 3
        ? 'Bon nivell de patrimoni acumulat respecte als ingressos.'
        : 'Patrimoni en construcció. La inversió sistemàtica és clau per accelerar-ne el creixement.',
    },
    {
      label:       'Viabilitat de l\'objectiu',
      value:       `${d.feasibilityScore}/100`,
      status:      d.feasibilityScore >= 70 ? 'good' : d.feasibilityScore >= 40 ? 'warning' : 'alert',
      explanation: d.feasibilityScore >= 70
        ? 'L\'objectiu financer és molt assolible amb les aportacions planificades.'
        : d.feasibilityScore >= 40
        ? 'L\'objectiu és assolible però requereix disciplina en les aportacions.'
        : 'L\'objectiu és ambiciós. Considera ampliar l\'horitzó o augmentar les aportacions.',
    },
  ];

  return {
    savingsRate:           d.savingsRate,
    debtToIncomeRatio:     d.debtToIncomeRatio,
    emergencyFundMonths:   d.emergencyFundMonths,
    netWorthToIncomeRatio: d.netWorthToIncomeRatio,
    investableAmount:      d.investableAmount,
    feasibilityScore:      d.feasibilityScore,
    diagnosticItems,
  };
}

// ─── PORTFOLIO SECTION ────────────────────────────────────────────────────────

function buildPortfolioSection(portfolio: Portfolio): PortfolioSection {
  const allocations: AllocationItem[] = portfolio.allocations.map(a => ({
    name:           a.product.name,
    isin:           a.product.isin,
    manager:        a.product.manager,
    weight:         a.weight,
    amount:         a.amount,
    assetClass:     a.product.category,
    ter:            a.product.ter,
    risk:           a.product.risk,
    rationale:      a.rationale,
    dataStatus:     a.product.dataStatus,
  }));

  const assetAllocation = buildAssetAllocation(portfolio);

  const selectionCriteria = [
    'Diversificació adequada per classe d\'actiu, geografia i estil de gestió',
    'Qualitat i trajectòria contrastada de la gestora',
    'Costos (TER) competitius respecte a la categoria',
    'Coherència del benchmark amb l\'estratègia declarada',
    'Consistència de resultats i tracking error controlat',
    'Liquiditat suficient per al perfil de l\'inversor',
    'Nivell de risc alineat amb el perfil recomanat',
    'Divisa i cobertura de canvi considerada',
    'Adequació al perfil inversor determinat pel qüestionari',
  ];

  const characteristics = [
    `Pes renda variable: ${portfolio.characteristics.equityWeight}%`,
    `Pes renda fixa: ${portfolio.characteristics.fixedIncomeWeight}%`,
    `Alternatives i immobiliari: ${portfolio.characteristics.alternativesWeight}%`,
    `Liquiditat / monetari: ${portfolio.characteristics.cashWeight}%`,
    `Estil de gestió: ${portfolio.characteristics.managementStyle}`,
    `Diversificació geogràfica: ${portfolio.characteristics.geographicDiversification.join(', ')}`,
    `Divises principals: ${portfolio.characteristics.mainCurrencies.join(', ')}`,
  ];

  return {
    name:        portfolio.name,
    description: portfolio.description,
    allocations,
    assetAllocation,
    characteristics,
    selectionCriteria,
  };
}

function buildAssetAllocation(portfolio: Portfolio): AssetAllocationItem[] {
  const colors: Record<string, string> = {
    'Renda Variable':  '#3b82f6',
    'Renda Fixa':      '#10b981',
    'Monetari':        '#8b5cf6',
    'Alternatives':    '#f59e0b',
    'Immobiliari':     '#ef4444',
  };

  return [
    { category: 'Renda Variable',  weight: portfolio.characteristics.equityWeight,       color: colors['Renda Variable'] },
    { category: 'Renda Fixa',      weight: portfolio.characteristics.fixedIncomeWeight,  color: colors['Renda Fixa'] },
    { category: 'Monetari',        weight: portfolio.characteristics.cashWeight,         color: colors['Monetari'] },
    { category: 'Alternatives',    weight: portfolio.characteristics.alternativesWeight, color: colors['Alternatives'] },
  ].filter(item => item.weight > 0);
}

// ─── BENCHMARK SECTION ────────────────────────────────────────────────────────

function buildBenchmarkSection(portfolio: Portfolio): BenchmarkSection {
  const bm = portfolio.benchmark;

  const components: BenchmarkComponentItem[] = bm.components.map(c => ({
    index:       c.index,
    weight:      c.weight,
    description: c.description,
  }));

  const rationale = `El benchmark compost s'ha construït per reflectir una cartera passiva equivalent al perfil ${getProfileLabel(portfolio.profile)}, amb una distribució d'actius coherent amb el nivell de risc establert. Serveix com a referència metodològica, no com a rival impossible.`;

  const diff = portfolio.expectedReturn - bm.expectedReturn;
  const comparisonNote = diff >= 0
    ? `La cartera té una rendibilitat esperada de ${diff.toFixed(1)}pp superior al benchmark. La selecció activa de fons aporta valor potencial afegit.`
    : `La cartera té una rendibilitat esperada de ${Math.abs(diff).toFixed(1)}pp inferior al benchmark. Això és degut a una composició més defensiva i als costos dels fons d'inversió seleccionats. A canvi, s'espera menor volatilitat i millor gestió del risc.`;

  return { name: bm.name, description: bm.description, components, rationale, comparisonNote };
}

// ─── METRICS SECTION ──────────────────────────────────────────────────────────

function buildMetricsSection(
  metrics:   PortfolioMetrics,
  portfolio: Portfolio
): MetricsSection {

  const rollingReturns: RollingReturnItem[] = metrics.rollingReturns.map(r => ({
    period:          r.period,
    portfolioReturn: r.portfolioReturn,
    benchmarkReturn: r.benchmarkReturn,
    excess:          r.excess,
    statusLabel:     r.excess >= 0 ? '▲ Supera benchmark' : '▼ Sota benchmark',
  }));

  const riskContributions: RiskContributionItem[] = metrics.riskContributions.map(r => ({
    productName:      r.productName,
    weight:           r.weight,
    riskContribution: r.riskContribution,
    marginalRisk:     r.marginalRisk,
  }));

  return {
    status:      metrics.dataQuality.dataSourceNote,
    statusColor: metrics.status === 'calculated' ? 'green' : 'yellow',
    annualizedReturn: {
      value:       metrics.annualizedReturn,
      formatted:   `${metrics.annualizedReturn.toFixed(2)}%`,
      label:       'Rendibilitat Anualitzada',
      explanation: 'Rendibilitat mitjana anual composta de la cartera en el període analitzat.',
      status:      metrics.annualizedReturn >= 5 ? 'good' : metrics.annualizedReturn >= 2 ? 'neutral' : 'warning',
    },
    annualizedVolatility: {
      value:       metrics.annualizedVolatility,
      formatted:   `${metrics.annualizedVolatility.toFixed(2)}%`,
      label:       'Volatilitat Anualitzada',
      explanation: 'Desviació estàndard anualitzada dels retorns. Mesura el nivell de fluctuació de la cartera.',
      status:      metrics.annualizedVolatility <= 10 ? 'good' : metrics.annualizedVolatility <= 18 ? 'neutral' : 'warning',
    },
    sharpeRatio: {
      value:       metrics.sharpeRatio,
      formatted:   metrics.sharpeRatio.toFixed(2),
      label:       'Ratio de Sharpe',
      explanation: 'Rendibilitat en excés per unitat de risc. >1 és excel·lent, >0.5 és bo, <0 és desfavorable.',
      status:      metrics.sharpeRatio >= 0.8 ? 'good' : metrics.sharpeRatio >= 0.4 ? 'neutral' : 'warning',
    },
    sortinoRatio: {
      value:       metrics.sortinoRatio,
      formatted:   metrics.sortinoRatio.toFixed(2),
      label:       'Ratio de Sortino',
      explanation: 'Com el Sharpe, però penalitza només la volatilitat negativa. Millor indicador per a inversors conservadors.',
      status:      metrics.sortinoRatio >= 1.0 ? 'good' : metrics.sortinoRatio >= 0.5 ? 'neutral' : 'warning',
    },
    maxDrawdown: {
      value:       metrics.maxDrawdown,
      formatted:   `${metrics.maxDrawdown.toFixed(2)}%`,
      label:       'Drawdown Màxim',
      explanation: 'Màxima caiguda des d\'un màxim fins a un mínim. Indica la pitjor pèrdua que hauria experimentat l\'inversor.',
      status:      metrics.maxDrawdown >= -10 ? 'good' : metrics.maxDrawdown >= -25 ? 'neutral' : 'warning',
    },
    calmarRatio: {
      value:       metrics.calmarRatio,
      formatted:   metrics.calmarRatio.toFixed(2),
      label:       'Ràtio de Calmar',
      explanation: 'Rendibilitat anualitzada dividida pel drawdown màxim absolut. Mesura l\'eficiència ajustada al risc extrem.',
      status:      metrics.calmarRatio >= 0.5 ? 'good' : metrics.calmarRatio >= 0.2 ? 'neutral' : 'warning',
    },
    beta: {
      value:       metrics.beta,
      formatted:   metrics.beta.toFixed(2),
      label:       'Beta vs Benchmark',
      explanation: 'Sensibilitat de la cartera als moviments del benchmark. Beta <1 indica menys volatilitat que el mercat.',
      status:      metrics.beta <= 1.0 ? 'good' : 'neutral',
    },
    trackingError: {
      value:       metrics.trackingError,
      formatted:   `${metrics.trackingError.toFixed(2)}%`,
      label:       'Tracking Error',
      explanation: 'Desviació dels retorns de la cartera respecte al benchmark. Reflecteix el grau de gestió activa.',
      status:      'neutral',
    },
    interpretation: getMetricsInterpretation(metrics, portfolio),
    rollingReturns,
    riskContributions,
  };
}

// ─── MONTE CARLO SECTION ──────────────────────────────────────────────────────

function buildMonteCarloSection(
  mc: MonteCarloResult,
  q:  InvestorQuestionnaire
): MonteCarloSection {

  return {
    numSimulations:    mc.params.numSimulations ?? 1000,
    horizon:           mc.params.investmentHorizon,
    p10:               mc.percentiles.p10,
    p50:               mc.percentiles.p50,
    p90:               mc.percentiles.p90,
    totalInvested:     mc.summary.totalInvested,
    medianGain:        mc.summary.medianGain,
    medianGainPct:     mc.summary.medianGainPercentage,
    probPositive:      mc.probabilityAnalysis.probabilityPositiveReturn,
    probBeatInflation: mc.probabilityAnalysis.probabilityBeatInflation,
    probReachTarget:   mc.probabilityAnalysis.probabilityReachTarget,
    targetAmount:      q.targetAmount,
    realValue:         mc.inflationAdjusted.p50RealValue,
    inflationRate:     mc.inflationAdjusted.inflationRate,
    scenarioNote:      mc.note,
    interpretation:    buildMonteCarloInterpretation(mc, q),
  };
}

// ─── COSTS SECTION ────────────────────────────────────────────────────────────

function buildCostsSection(
  portfolio:    Portfolio,
  questionnaire: InvestorQuestionnaire
): CostsSection {

  const investableAmount = questionnaire.currentSavings * (questionnaire.percentageToInvest / 100);
  const totalTERAmount   = Math.round(investableAmount * portfolio.totalTER / 100);

  const costItems: CostItem[] = portfolio.allocations.map(a => ({
    productName:    a.product.name,
    weight:         a.weight,
    ter:            a.product.ter,
    weightedCost:   Math.round(a.weight * a.product.ter) / 100,
    managementType: a.product.managementType,
  }));

  const activeItems = costItems.filter(c => c.managementType === 'activa');
  const indexItems  = costItems.filter(c => c.managementType !== 'activa');

  const activeTER = activeItems.length > 0
    ? activeItems.reduce((s, c) => s + c.ter, 0) / activeItems.length : 0;
  const indexTER  = indexItems.length > 0
    ? indexItems.reduce((s, c) => s + c.ter, 0) / indexItems.length : 0;
  const savingsVsActive = Math.round((activeTER - portfolio.totalTER) * 100) / 100;

  return {
    totalTER:       portfolio.totalTER,
    totalTERAmount,
    costItems,
    costComparison: {
      activeFundsAvgTER:  Math.round(activeTER * 100) / 100,
      indexFundsAvgTER:   Math.round(indexTER * 100) / 100,
      portfolioTER:       portfolio.totalTER,
      savingsVsActive,
      note: savingsVsActive > 0
        ? `La combinació de fons indexats i actius permet un estalvi de ${savingsVsActive.toFixed(2)}pp respecte a una cartera íntegrament de gestió activa.`
        : 'La cartera utilitza fons de gestió activa seleccionats per qualitat i track record.',
    },
    costNote: `El cost total ponderat de la cartera és del ${portfolio.totalTER.toFixed(2)}% anual (${formatCurrency(totalTERAmount)} anuals estimats sobre el capital inicial). Els costos s'apliquen automàticament sobre el valor liquidatiu dels fons i no es cobren de forma separada.`,
  };
}

// ─── DATA SECTION ─────────────────────────────────────────────────────────────

function buildDataSection(portfolio: Portfolio): DataSection {
  const statusCounts = { validated: 0, partial: 0, pending: 0, unavailable: 0 };
  portfolio.allocations.forEach(a => {
    statusCounts[a.product.dataStatus]++;
  });

  const sources: DataSourceItem[] = [
    { name: '✅ Dades validades',         status: 'validated',  color: 'green',  count: statusCounts.validated },
    { name: '⚠️ Dades parcials',          status: 'partial',    color: 'yellow', count: statusCounts.partial },
    { name: '🕐 Pendent de dades',        status: 'pending',    color: 'blue',   count: statusCounts.pending },
    { name: '❌ Dades no disponibles',    status: 'unavailable', color: 'red',   count: statusCounts.unavailable },
  ].filter(s => s.count > 0);

  return {
    overallStatus: statusCounts.validated > 0
      ? '✅ Dades parcialment validades'
      : '⚠️ Dades estimades — Configura les API keys per obtenir dades reals',
    sources,
    disclaimer: 'Les dades financeres provenen de Financial Modeling Prep, Alpha Vantage i Yahoo Finance com a font alternativa. Les mètriques no validades són estimacions basades en paràmetres de mercat de referència i no han de considerar-se com a dades reals.',
    lastUpdated: new Date().toLocaleDateString('ca-ES'),
  };
}

// ─── RISKS SECTION ────────────────────────────────────────────────────────────

function buildRisksSection(
  portfolio: Portfolio,
  scoring:   ScoringResult
): RisksSection {

  const mainRisks: RiskItem[] = [
    {
      category:    'Risc de mercat',
      description: 'Les fluctuacions del mercat poden reduir el valor de la cartera, especialment a curt termini.',
      level:       portfolio.profile === 'conservador' ? 'baix' : portfolio.profile === 'moderat' ? 'moderat' : portfolio.profile === 'dinamic' ? 'alt' : 'molt-alt',
      mitigation:  'Diversificació àmplia per classe d\'actiu, geografia i sector. Horitzó temporal llarg.',
    },
    {
      category:    'Risc de tipus d\'interès',
      description: 'Les variacions dels tipus d\'interès afecten principalment als actius de renda fixa.',
      level:       portfolio.characteristics.fixedIncomeWeight > 40 ? 'alt' : portfolio.characteristics.fixedIncomeWeight > 20 ? 'moderat' : 'baix',
      mitigation:  'Diversificació de durades i reducció de la sensibilitat als tipus via fons de curta durada.',
    },
    {
      category:    'Risc de divisa',
      description: 'Inversions en divises estrangeres (USD, GBP) poden generar pèrdues per variació del tipus de canvi.',
      level:       'moderat',
      mitigation:  'Part de la cartera en EUR. Diversificació de divises. Horitzó temporal que permet absorció.',
    },
    {
      category:    'Risc de liquiditat',
      description: 'Alguns fons d\'inversió poden tenir restriccions de reemborssament en condicions de mercat extremes.',
      level:       scoring.profile === 'conservador' ? 'baix' : 'moderat',
      mitigation:  'Fons seleccionats amb alta liquiditat diària. Component monetari per necessitats immediates.',
    },
    {
      category:    'Risc de concentració',
      description: 'Exposició elevada a un sector, país o empresa pot amplificar pèrdues davant d\'events específics.',
      level:       portfolio.profile === 'agressiu' ? 'alt' : 'moderat',
      mitigation:  'Diversificació en múltiples fons, gestores, sectors i geografies.',
    },
    {
      category:    'Risc de gestió',
      description: 'Els fons de gestió activa poden no complir les expectatives de rendibilitat respecte al benchmark.',
      level:       'moderat',
      mitigation:  'Combinació de gestió indexada i activa. Selecció de gestores amb track record contrastat.',
    },
  ];

  const mitigants = [
    'Diversificació àmplia per classe d\'actiu, geografia, sector i estil de gestió',
    'Horitzó temporal suficient per absorir volatilitat de curt termini',
    'Revisió periòdica de la cartera i rebalanceig si cal',
    'Aportacions mensuals per aplicar l\'efecte del cost mitjà (DCA)',
    'Component de liquiditat i monetari per necessitats imprevisibles',
    'Selecció de gestores de primer nivell amb solidesa patrimonial',
  ];

  const followUpPlan = [
    'Revisió semestral de la cartera i comparació amb benchmark',
    'Rebalanceig anual si algun pes s\'allunya >5% del pes objectiu',
    'Revisió del perfil inversor en cas de canvis vitals significatius',
    'Monitoratge dels fons: canvis de gestor, estil o política d\'inversió',
    'Actualització de l\'objectiu financer si canvien les circumstàncies',
  ];

  return { mainRisks, mitigants, followUpPlan };
}

// ─── CONCLUSION SECTION ───────────────────────────────────────────────────────

function buildConclusionSection(
  portfolio:    Portfolio,
  questionnaire: InvestorQuestionnaire
): ConclusionSection {

  const reviewDate = new Date();
  reviewDate.setMonth(reviewDate.getMonth() + 6);

  return {
    summary: `La ${portfolio.name} proposada s'adequa al perfil ${getProfileLabel(portfolio.profile)} de l'inversor, considerant l'horitzó temporal de ${questionnaire.investmentHorizon} anys, la tolerància al risc i els objectius financers declarats. La cartera ofereix una diversificació adequada, un cost raonable i una composició coherent amb les expectatives de mercat a llarg termini.`,
    nextSteps: [
      'Revisar i validar la proposta amb un assessor financer regulat si es desitja',
      'Confirmar la disponibilitat dels fons seleccionats al teu banc o broker habitual',
      'Verificar la fiscalitat aplicable als fons d\'inversió al teu país de residència',
      'Iniciar la inversió de forma gradual si el mercat es troba en màxims recents',
      'Configurar aportacions mensuals automàtiques per aplicar l\'estratègia DCA',
      'Programar la primera revisió semestral de la cartera',
    ],
    reviewDate:      reviewDate.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' }),
    reviewFrequency: 'Semestral (cada 6 mesos) o en cas de canvis significatius del mercat o personals',
  };
}

// ─── LEGAL DISCLAIMER ─────────────────────────────────────────────────────────

export const LEGAL_DISCLAIMER = `
AVÍS LEGAL IMPORTANT

Aquest informe ha estat generat per RoboAdvisor Pro, una eina digital de suport a la decisió d'inversió amb finalitat educativa i orientativa.

LIMITACIONS: Aquest document constitueix una proposta orientativa i una simulació professional basada en les dades facilitades per l'usuari i en paràmetres de mercat de referència. No constitueix un assessorament financer personalitzat regulat en el sentit de la Directiva MiFID II ni de cap altra normativa financera aplicable.

NO ÉS RECOMANACIÓ D'INVERSIÓ: La informació continguda en aquest informe no representa una recomanació d'inversió personalitzada regulada. RoboAdvisor Pro no és una entitat financera regulada i no executa operacions financeres reals.

RENDIMENTS PASSATS: Els rendiments passats no garanteixen rendiments futurs. Les projeccions i simulacions (incloent el model Monte Carlo) es basen en supòsits estadístics i no poden garantir resultats reals.

DADES: Algunes dades financeres mostrades poden ser estimades, simulades o parcials. Es recomana verificar-les amb fonts oficials abans de prendre cap decisió d'inversió.

RISC: Tota inversió comporta risc de pèrdua parcial o total del capital invertit. L'inversor és l'únic responsable de les seves decisions d'inversió.

RECOMANACIÓ: Es recomana consultar un assessor financer independent i regulat (EAFI, IFA o entitat financera autoritzada) abans de prendre decisions d'inversió significatives.

© ${new Date().getFullYear()} RoboAdvisor Pro — Eina de suport a la decisió d'inversió
`.trim();

// ─── UTILS ────────────────────────────────────────────────────────────────────

function pct(score: number, max: number): number {
  return Math.round((score / max) * 100);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ca-ES', {
    style:                 'currency',
    currency:              'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getFeasibility(score: number): 'alta' | 'moderada' | 'baixa' | 'molt-baixa' {
  if (score >= 70) return 'alta';
  if (score >= 40) return 'moderada';
  if (score >= 20) return 'baixa';
  return 'molt-baixa';
}

function buildFeasibilityNote(
  feasibility: string,
  mc: MonteCarloResult
): string {
  const prob = mc.probabilityAnalysis.probabilityReachTarget;
  return `Probabilitat estimada d'assolir l'objectiu: ${prob}%. ${
    feasibility === 'alta'      ? 'L\'objectiu és molt assolible amb les aportacions planificades.' :
    feasibility === 'moderada'  ? 'L\'objectiu és assolible amb disciplina en les aportacions mensuals.' :
    feasibility === 'baixa'     ? 'L\'objectiu és ambiciós. Considera ampliar el termini o augmentar aportacions.' :
    'L\'objectiu és molt difícil d\'assolir. Revisa els paràmetres de la inversió.'
  }`;
}

function getProfileIconEmoji(profile: InvestorProfile): string {
  const icons: Record<InvestorProfile, string> = {
    conservador: '🛡️', moderat: '⚖️', dinamic: '📈', agressiu: '🚀',
  };
  return icons[profile];
}

function getMetricsInterpretation(
  metrics:   PortfolioMetrics,
  portfolio: Portfolio
): string {
  const sharpe = metrics.sharpeRatio;
  if (sharpe >= 0.8) return `La cartera presenta una excel·lent relació risc/rendibilitat (Sharpe: ${sharpe.toFixed(2)}). La rendibilitat compensa adequadament el risc assumit.`;
  if (sharpe >= 0.4) return `La cartera presenta una bona relació risc/rendibilitat (Sharpe: ${sharpe.toFixed(2)}), consistent amb el perfil ${getProfileLabel(portfolio.profile)}.`;
  return `La relació risc/rendibilitat és moderada (Sharpe: ${sharpe.toFixed(2)}). Les mètriques estan pendents de validació amb dades reals de mercat.`;
}

function buildMonteCarloInterpretation(
  mc: MonteCarloResult,
  q:  InvestorQuestionnaire
): string {
  return `En l'escenari central (P50), la cartera podria assolir ${new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(mc.percentiles.p50)} en ${q.investmentHorizon} anys, sobre un total invertit de ${new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(mc.summary.totalInvested)}. En l'escenari pessimista (P10), el valor seria de ${new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(mc.percentiles.p10)}, i en l'optimista (P90) podria arribar a ${new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(mc.percentiles.p90)}. La probabilitat d'obtenir un retorn positiu és del ${mc.probabilityAnalysis.probabilityPositiveReturn}%.`;
}
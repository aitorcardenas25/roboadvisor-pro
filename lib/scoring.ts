// lib/scoring.ts
// Lògica de perfilació i scoring de l'inversor

import { InvestorProfile } from './products';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface InvestorQuestionnaire {
  // Dades del client
  clientName:  string;
  clientEmail?: string;

  // Dades personals i financeres
  age:                 number;
  annualIncome:        number;
  monthlyExpenses:     number;
  currentSavings:      number;
  netWorth:            number;
  totalDebt:           number;

  // Objectiu i horitzó
  financialGoal:       FinancialGoal;
  investmentHorizon:   number;
  targetAmount:        number;
  initialInvestment:   number;
  monthlyContribution: number;
  percentageToInvest:  number;

  // Coneixement i experiència
  financialKnowledge:   KnowledgeLevel;
  investmentExperience: ExperienceLevel;

  // Tolerància al risc
  lossTolerance:       LossTolerance;
  reactionToDrops:     ReactionToDrops;
  worstAcceptableLoss: number;

  // Preferències
  esgPreference: ESGPreference;
  liquidityNeed: LiquidityNeed;
}

export type FinancialGoal =
  | 'preservar-capital'
  | 'generar-ingressos'
  | 'creixement-moderat'
  | 'creixement-alt'
  | 'maxima-rendibilitat'
  | 'jubilacio'
  | 'compra-immoble'
  | 'fons-emergencia'
  | 'educacio-fills';

export type KnowledgeLevel =
  | 'cap'
  | 'basic'
  | 'intermedi'
  | 'avançat'
  | 'expert';

export type ExperienceLevel =
  | 'cap'
  | 'menys-1-any'
  | '1-3-anys'
  | '3-5-anys'
  | 'mes-5-anys';

export type LossTolerance =
  | 'no-accepto-perdues'
  | 'fins-5'
  | 'fins-10'
  | 'fins-20'
  | 'fins-30'
  | 'mes-30';

export type ReactionToDrops =
  | 'vendre-tot'
  | 'vendre-part'
  | 'no-fer-res'
  | 'comprar-mes'
  | 'comprar-agressivament';

export type ESGPreference =
  | 'no-importa'
  | 'preferible'
  | 'important'
  | 'essencial';

export type LiquidityNeed =
  | 'no-necessito'
  | 'potser-3-anys'
  | 'potser-1-any'
  | 'potser-6-mesos'
  | 'necessito-ja';

// ─── SCORING RESULT ───────────────────────────────────────────────────────────

export interface ScoringResult {
  profile:         InvestorProfile;
  totalScore:      number;
  maxScore:        number;
  scorePercentage: number;
  breakdown:       ScoreBreakdown;
  diagnostics:     FinancialDiagnostics;
  warnings:        string[];
  strengths:       string[];
}

export interface ScoreBreakdown {
  horizonScore:       number;
  knowledgeScore:     number;
  experienceScore:    number;
  toleranceScore:     number;
  reactionScore:      number;
  goalScore:          number;
  liquidityScore:     number;
  financialHealthScore: number;
}

export interface FinancialDiagnostics {
  savingsRate:           number;
  debtToIncomeRatio:     number;
  emergencyFundMonths:   number;
  netWorthToIncomeRatio: number;
  investableAmount:      number;
  feasibilityScore:      number;
}

// ─── VALIDATION ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  isValid:  boolean;
  errors:   string[];
  warnings: string[];
}

export function validateQuestionnaire(q: InvestorQuestionnaire): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!q.clientName || q.clientName.trim().length < 2) {
    errors.push('El nom del client és obligatori (mínim 2 caràcters).');
  }

  if (!q.age || q.age < 18 || q.age > 100) {
    errors.push('L\'edat ha de ser entre 18 i 100 anys.');
  }

  if (!q.investmentHorizon || q.investmentHorizon <= 0) {
    errors.push('L\'horitzó temporal ha de ser superior a 0 anys.');
  }

  if (!q.annualIncome || q.annualIncome <= 0) {
    errors.push('Els ingressos anuals han de ser superiors a 0.');
  }

  if (!q.targetAmount || q.targetAmount <= 0) {
    errors.push('L\'import objectiu ha de ser superior a 0.');
  }

  if (q.percentageToInvest > 100 || q.percentageToInvest <= 0) {
    errors.push('El percentatge d\'estalvis a invertir ha de ser entre 1% i 100%.');
  }

  if (q.initialInvestment < 0) {
    errors.push('La inversió inicial no pot ser negativa.');
  }

  const monthlyIncome = q.annualIncome / 12;
  if (q.monthlyExpenses > monthlyIncome) {
    warnings.push(
      `Les despeses mensuals (${formatCurrency(q.monthlyExpenses)}) superen els ingressos mensuals (${formatCurrency(monthlyIncome)}). Revisa les dades.`
    );
  }

  if (q.age > 60 && q.investmentHorizon > 20) {
    warnings.push('L\'horitzó temporal sembla molt llarg considerant l\'edat.');
  }

  if (q.totalDebt > q.annualIncome * 5) {
    warnings.push('El nivell de deute és molt elevat respecte als ingressos.');
  }

  if (q.initialInvestment > q.currentSavings) {
    warnings.push('La inversió inicial supera els estalvis actuals declarats.');
  }

  if (q.targetAmount > 0 && q.initialInvestment > q.targetAmount) {
    warnings.push('La inversió inicial supera l\'import objectiu. Revisa els valors.');
  }

  return { isValid: errors.length === 0, errors, warnings };
}

// ─── SCORING ENGINE ───────────────────────────────────────────────────────────

export function calculateScore(q: InvestorQuestionnaire): ScoringResult {
  const horizonScore       = scoreHorizon(q.investmentHorizon);
  const knowledgeScore     = scoreKnowledge(q.financialKnowledge);
  const experienceScore    = scoreExperience(q.investmentExperience);
  const toleranceScore     = scoreLossTolerance(q.lossTolerance);
  const reactionScore      = scoreReaction(q.reactionToDrops);
  const goalScore          = scoreGoal(q.financialGoal);
  const liquidityScore     = scoreLiquidity(q.liquidityNeed);
  const diagnostics        = calculateDiagnostics(q);
  const financialHealthScore = scoreFinancialHealth(diagnostics);

  const totalScore =
    horizonScore + knowledgeScore + experienceScore +
    toleranceScore + reactionScore + goalScore +
    liquidityScore + financialHealthScore;

  const maxScore       = 115;
  const scorePercentage = Math.round((totalScore / maxScore) * 100);
  const profile        = determineProfile(scorePercentage, q);
  const warnings       = generateWarnings(q, diagnostics);
  const strengths      = generateStrengths(q, diagnostics);

  return {
    profile, totalScore, maxScore, scorePercentage,
    breakdown: {
      horizonScore, knowledgeScore, experienceScore,
      toleranceScore, reactionScore, goalScore,
      liquidityScore, financialHealthScore,
    },
    diagnostics, warnings, strengths,
  };
}

// ─── SCORING FUNCTIONS ────────────────────────────────────────────────────────

function scoreHorizon(years: number): number {
  if (years >= 20) return 20;
  if (years >= 15) return 17;
  if (years >= 10) return 14;
  if (years >= 7)  return 11;
  if (years >= 5)  return 8;
  if (years >= 3)  return 5;
  if (years >= 1)  return 2;
  return 0;
}

function scoreKnowledge(level: KnowledgeLevel): number {
  const scores: Record<KnowledgeLevel, number> = {
    'cap': 0, 'basic': 4, 'intermedi': 8, 'avançat': 12, 'expert': 15,
  };
  return scores[level] ?? 0;
}

function scoreExperience(level: ExperienceLevel): number {
  const scores: Record<ExperienceLevel, number> = {
    'cap': 0, 'menys-1-any': 4, '1-3-anys': 8, '3-5-anys': 12, 'mes-5-anys': 15,
  };
  return scores[level] ?? 0;
}

function scoreLossTolerance(tolerance: LossTolerance): number {
  const scores: Record<LossTolerance, number> = {
    'no-accepto-perdues': 0, 'fins-5': 4, 'fins-10': 8,
    'fins-20': 13, 'fins-30': 17, 'mes-30': 20,
  };
  return scores[tolerance] ?? 0;
}

function scoreReaction(reaction: ReactionToDrops): number {
  const scores: Record<ReactionToDrops, number> = {
    'vendre-tot': 0, 'vendre-part': 4, 'no-fer-res': 8,
    'comprar-mes': 12, 'comprar-agressivament': 15,
  };
  return scores[reaction] ?? 0;
}

function scoreGoal(goal: FinancialGoal): number {
  const scores: Record<FinancialGoal, number> = {
    'preservar-capital': 0, 'fons-emergencia': 1, 'generar-ingressos': 3,
    'compra-immoble': 4, 'educacio-fills': 5, 'jubilacio': 6,
    'creixement-moderat': 7, 'creixement-alt': 9, 'maxima-rendibilitat': 10,
  };
  return scores[goal] ?? 5;
}

function scoreLiquidity(need: LiquidityNeed): number {
  const scores: Record<LiquidityNeed, number> = {
    'no-necessito': 10, 'potser-3-anys': 8, 'potser-1-any': 5,
    'potser-6-mesos': 2, 'necessito-ja': 0,
  };
  return scores[need] ?? 5;
}

function scoreFinancialHealth(d: FinancialDiagnostics): number {
  let score = 5;
  if (d.savingsRate >= 30)       score += 3;
  else if (d.savingsRate >= 20)  score += 2;
  else if (d.savingsRate >= 10)  score += 1;
  if (d.debtToIncomeRatio > 50)  score -= 3;
  else if (d.debtToIncomeRatio > 30) score -= 1;
  if (d.emergencyFundMonths >= 6) score += 2;
  else if (d.emergencyFundMonths >= 3) score += 1;
  return Math.max(0, Math.min(10, score));
}

// ─── DIAGNOSTICS ─────────────────────────────────────────────────────────────

function calculateDiagnostics(q: InvestorQuestionnaire): FinancialDiagnostics {
  const monthlyIncome   = q.annualIncome / 12;
  const monthlySavings  = monthlyIncome - q.monthlyExpenses;
  const savingsRate     = monthlyIncome > 0
    ? Math.max(0, (monthlySavings / monthlyIncome) * 100) : 0;
  const debtToIncomeRatio = q.annualIncome > 0
    ? (q.totalDebt / q.annualIncome) * 100 : 0;
  const emergencyFundMonths = q.monthlyExpenses > 0
    ? q.currentSavings / q.monthlyExpenses : 0;
  const netWorthToIncomeRatio = q.annualIncome > 0
    ? q.netWorth / q.annualIncome : 0;
  const investableAmount = q.currentSavings * (q.percentageToInvest / 100);
  const feasibilityScore = calculateFeasibility(q, investableAmount);

  return {
    savingsRate:           Math.round(savingsRate * 10) / 10,
    debtToIncomeRatio:     Math.round(debtToIncomeRatio * 10) / 10,
    emergencyFundMonths:   Math.round(emergencyFundMonths * 10) / 10,
    netWorthToIncomeRatio: Math.round(netWorthToIncomeRatio * 10) / 10,
    investableAmount:      Math.round(investableAmount),
    feasibilityScore,
  };
}

function calculateFeasibility(q: InvestorQuestionnaire, investableAmount: number): number {
  if (q.targetAmount <= 0 || q.investmentHorizon <= 0) return 0;
  const estimatedGrowthRate = 0.05;
  const months              = q.investmentHorizon * 12;
  const futureValueInitial  = investableAmount * Math.pow(1 + estimatedGrowthRate, q.investmentHorizon);
  const monthlyRate         = estimatedGrowthRate / 12;
  const futureValueContributions = monthlyRate > 0
    ? q.monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
    : q.monthlyContribution * months;
  const projectedTotal = futureValueInitial + futureValueContributions;
  const ratio          = projectedTotal / q.targetAmount;
  if (ratio >= 1.5) return 100;
  if (ratio >= 1.0) return 80;
  if (ratio >= 0.75) return 60;
  if (ratio >= 0.5) return 40;
  if (ratio >= 0.25) return 20;
  return 10;
}

// ─── PROFILE DETERMINATION ────────────────────────────────────────────────────

function determineProfile(scorePercentage: number, q: InvestorQuestionnaire): InvestorProfile {
  if (
    q.lossTolerance === 'no-accepto-perdues' ||
    q.liquidityNeed === 'necessito-ja' ||
    q.reactionToDrops === 'vendre-tot'
  ) return 'conservador';
  if (q.investmentHorizon <= 2) return 'conservador';
  if (q.investmentHorizon <= 4 && scorePercentage > 60) return 'moderat';
  if (scorePercentage >= 75) return 'agressiu';
  if (scorePercentage >= 55) return 'dinamic';
  if (scorePercentage >= 35) return 'moderat';
  return 'conservador';
}

// ─── WARNINGS & STRENGTHS ─────────────────────────────────────────────────────

function generateWarnings(q: InvestorQuestionnaire, d: FinancialDiagnostics): string[] {
  const warnings: string[] = [];
  if (d.savingsRate < 10)
    warnings.push('La taxa d\'estalvi és molt baixa. Considera reduir despeses per augmentar la capacitat d\'inversió.');
  if (d.emergencyFundMonths < 3)
    warnings.push('No tens un fons d\'emergència suficient (mínim 3 mesos de despeses). Prioritza-ho abans d\'invertir.');
  if (d.debtToIncomeRatio > 40)
    warnings.push('El nivell de deute és elevat. Considera reduir-lo abans d\'invertir de forma agressiva.');
  if (q.investmentHorizon < 3 && q.financialGoal === 'maxima-rendibilitat')
    warnings.push('Buscar màxima rendibilitat en un horitzó curt de temps implica un risc molt elevat de pèrdues.');
  if (d.feasibilityScore < 40)
    warnings.push('Amb les dades actuals, és poc probable assolir l\'objectiu financer establert. Revisa l\'import o el termini.');
  if (q.esgPreference === 'essencial' && q.financialGoal === 'maxima-rendibilitat')
    warnings.push('Combinar filtres ESG estrictes amb màxima rendibilitat pot limitar les opcions d\'inversió disponibles.');
  return warnings;
}

function generateStrengths(q: InvestorQuestionnaire, d: FinancialDiagnostics): string[] {
  const strengths: string[] = [];
  if (d.savingsRate >= 25)
    strengths.push(`Excel·lent taxa d\'estalvi del ${d.savingsRate.toFixed(1)}%. Tens una bona base per invertir.`);
  if (d.emergencyFundMonths >= 6)
    strengths.push(`Fons d\'emergència sòlid de ${d.emergencyFundMonths.toFixed(1)} mesos. Pots invertir amb tranquil·litat.`);
  if (q.investmentHorizon >= 10)
    strengths.push(`Horitzó temporal de ${q.investmentHorizon} anys. El temps és el teu millor aliat per invertir.`);
  if (q.financialKnowledge === 'avançat' || q.financialKnowledge === 'expert')
    strengths.push('Alt nivell de coneixement financer. Pots accedir a estratègies d\'inversió més sofisticades.');
  if (d.debtToIncomeRatio < 15)
    strengths.push('Baix nivell de deute. La teva situació financera és sòlida per assumir inversions.');
  if (d.feasibilityScore >= 80)
    strengths.push('El teu objectiu financer és molt assolible amb les aportacions planificades.');
  return strengths;
}

// ─── PROFILE LABELS ──────────────────────────────────────────────────────────

export function getProfileLabel(profile: InvestorProfile): string {
  const labels: Record<InvestorProfile, string> = {
    conservador: 'Conservador', moderat: 'Moderat',
    dinamic: 'Dinàmic', agressiu: 'Agressiu',
  };
  return labels[profile];
}

export function getProfileDescription(profile: InvestorProfile): string {
  const descriptions: Record<InvestorProfile, string> = {
    conservador: 'Prioritzes la preservació del capital per sobre de la rendibilitat. Acceptes rendibilitats modestes a canvi d\'estabilitat i baixa volatilitat. La teva cartera se centra en actius de baix risc.',
    moderat:     'Busques un equilibri entre seguretat i creixement. Acceptes cert nivell de volatilitat a canvi d\'una rendibilitat superior a la renda fixa. Cartera diversificada entre renda fixa i variable.',
    dinamic:     'Prioritzes el creixement del capital a mig-llarg termini. Acceptes volatilitat significativa amb la perspectiva de rendibilitats superiors. La renda variable és el pes principal de la cartera.',
    agressiu:    'Busques la màxima rendibilitat possible a llarg termini. Acceptes volatilitat molt alta i possibles pèrdues significatives en el curt termini. Cartera concentrada en renda variable de creixement.',
  };
  return descriptions[profile];
}

export function getProfileColor(profile: InvestorProfile): string {
  const colors: Record<InvestorProfile, string> = {
    conservador: '#10b981', moderat: '#3b82f6',
    dinamic: '#f59e0b', agressiu: '#ef4444',
  };
  return colors[profile];
}

export function getProfileIcon(profile: InvestorProfile): string {
  const icons: Record<InvestorProfile, string> = {
    conservador: '🛡️', moderat: '⚖️', dinamic: '📈', agressiu: '🚀',
  };
  return icons[profile];
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ca-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyPublic(amount: number): string {
  return formatCurrency(amount);
}
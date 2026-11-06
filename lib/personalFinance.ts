// lib/personalFinance.ts
// Anàlisi patrimonial i de flux de caixa personal del client, a partir
// exclusivament de les dades reals capturades al qüestionari de perfilació.
// Bloc descriptiu i diagnòstic — cap recomanació d'inversió ni de producte.
//
// No inventa ni estima cap dada: si no hi ha prou informació, retorna `null`
// i el bloc de pàgines corresponent no es renderitza.

import { InvestorQuestionnaire, ScoringResult } from './scoring';

// ─── TIPUS ──────────────────────────────────────────────────────────────────

export interface PersonalBalanceSheet {
  totalAssets:      number;
  totalLiabilities: number;
  netWorth:         number;
  liabilitiesPct:   number; // % del total d'actius
  netWorthPct:      number; // % del total d'actius
}

export interface PersonalCashFlow {
  grossAnnualIncome: number;
  annualExpenses:    number;
  annualBalance:     number; // pot ser negatiu (despeses > ingressos)
  savingsRateSigned: number; // % sense limitar a 0, per mostrar dèficit real
  isDeficit:         boolean;
}

export type RatioStatus = 'verd' | 'ambre' | 'vermell';

export interface PersonalRatio {
  key:         string;
  label:       string;
  value:       number;
  valueLabel:  string;
  reference:   string;
  status:      RatioStatus;
  explanation: string; // què mesura i per què importa (una línia)
}

export interface DiagnosisItem {
  headline: string; // conclusió en llenguatge planer
  detail:   string; // dada concreta que la sustenta
  status:   RatioStatus;
}

export interface PersonalFinanceAnalysis {
  balanceSheet: PersonalBalanceSheet;
  cashFlow:     PersonalCashFlow;
  ratios:       PersonalRatio[];
  diagnosis:    DiagnosisItem[];
}

// ─── PUNT D'ENTRADA ─────────────────────────────────────────────────────────

/**
 * Retorna l'anàlisi patrimonial personal, o `null` si no hi ha prou dades
 * reals per construir-la (degradació elegant: el bloc no es renderitza).
 */
export function analyzePersonalFinance(
  q:       InvestorQuestionnaire,
  scoring: ScoringResult,
): PersonalFinanceAnalysis | null {
  if (!q.annualIncome || q.annualIncome <= 0) return null;
  if (q.monthlyExpenses === undefined || q.monthlyExpenses === null || q.monthlyExpenses < 0) return null;

  const balanceSheet = buildBalanceSheet(q);
  const cashFlow     = buildCashFlow(q);
  const ratios       = buildRatios(q, scoring, cashFlow);
  const diagnosis    = buildDiagnosis(q, scoring, cashFlow, ratios);

  return { balanceSheet, cashFlow, ratios, diagnosis };
}

// ─── BALANÇ PATRIMONIAL ─────────────────────────────────────────────────────

function buildBalanceSheet(q: InvestorQuestionnaire): PersonalBalanceSheet {
  // Identitat comptable: Actiu = Passiu + Patrimoni net.
  // No hi ha desglossament per categoria d'actiu/passiu al qüestionari
  // actual, per això es mostra el balanç agregat (no per categories).
  const totalLiabilities = Math.max(0, q.totalDebt);
  const netWorth          = q.netWorth;
  const totalAssets       = netWorth + totalLiabilities;

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    liabilitiesPct: totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0,
    netWorthPct:    totalAssets > 0 ? (netWorth / totalAssets) * 100 : 0,
  };
}

// ─── FLUX DE CAIXA ──────────────────────────────────────────────────────────

function buildCashFlow(q: InvestorQuestionnaire): PersonalCashFlow {
  const grossAnnualIncome = q.annualIncome;
  const annualExpenses    = q.monthlyExpenses * 12;
  const annualBalance     = grossAnnualIncome - annualExpenses;
  const savingsRateSigned = grossAnnualIncome > 0
    ? (annualBalance / grossAnnualIncome) * 100
    : 0;

  return {
    grossAnnualIncome,
    annualExpenses,
    annualBalance,
    savingsRateSigned: Math.round(savingsRateSigned * 10) / 10,
    isDeficit: annualBalance < 0,
  };
}

// ─── RÀTIOS DE SALUT FINANCERA ──────────────────────────────────────────────

function buildRatios(
  q:        InvestorQuestionnaire,
  scoring:  ScoringResult,
  cashFlow: PersonalCashFlow,
): PersonalRatio[] {
  const d = scoring.diagnostics;
  const ratios: PersonalRatio[] = [];

  // 1. Taxa d'estalvi (reutilitza el mateix càlcul que la pàgina de diagnòstic)
  ratios.push({
    key:   'savingsRate',
    label: 'Taxa d\'estalvi',
    value: d.savingsRate,
    valueLabel: `${d.savingsRate.toFixed(1)}%`,
    reference:  '<10% baix · 10-20% correcte · >20% sòlid',
    status: d.savingsRate >= 20 ? 'verd' : d.savingsRate >= 10 ? 'ambre' : 'vermell',
    explanation: 'Percentatge dels ingressos anuals que queda un cop pagades totes les despeses.',
  });

  // 2. Fons d'emergència en mesos de despeses cobertes
  ratios.push({
    key:   'emergencyFund',
    label: 'Fons d\'emergència',
    value: d.emergencyFundMonths,
    valueLabel: `${d.emergencyFundMonths.toFixed(1)} mesos`,
    reference:  '3-6 mesos de despeses cobertes',
    status: d.emergencyFundMonths >= 6 ? 'verd' : d.emergencyFundMonths >= 3 ? 'ambre' : 'vermell',
    explanation: 'Quant de temps podries cobrir les despeses habituals amb els estalvis actuals si deixessis d\'ingressar.',
  });

  // 3. Ràtio d'endeutament — calculat com deute total sobre ingressos anuals
  //    bruts (no es disposa de la quota mensual del deute al qüestionari).
  ratios.push({
    key:   'debtRatio',
    label: 'Ràtio d\'endeutament',
    value: d.debtToIncomeRatio,
    valueLabel: `${d.debtToIncomeRatio.toFixed(1)}%`,
    reference:  'Deute total / ingressos anuals bruts (referència: <35%)',
    status: d.debtToIncomeRatio <= 15 ? 'verd' : d.debtToIncomeRatio <= 35 ? 'ambre' : 'vermell',
    explanation: 'Quant deute acumulat tens en relació als teus ingressos d\'un any. Com més baix, més marge financer.',
  });

  // 4. Ràtio de liquiditat — actius líquids / despeses mensuals
  const liquidityRatio = q.monthlyExpenses > 0 ? q.currentSavings / q.monthlyExpenses : 0;
  ratios.push({
    key:   'liquidityRatio',
    label: 'Ràtio de liquiditat',
    value: liquidityRatio,
    valueLabel: `${liquidityRatio.toFixed(1)}x`,
    reference:  'Estalvis disponibles sobre una mensualitat de despeses (referència: mínim 3x)',
    status: liquidityRatio >= 6 ? 'verd' : liquidityRatio >= 3 ? 'ambre' : 'vermell',
    explanation: 'Mesura la mateixa idea que el fons d\'emergència, expressada com a múltiple d\'una mensualitat de despeses.',
  });

  // 5. Patrimoni net sobre ingressos anuals
  ratios.push({
    key:   'netWorthRatio',
    label: 'Patrimoni net / ingressos anuals',
    value: d.netWorthToIncomeRatio,
    valueLabel: `${d.netWorthToIncomeRatio.toFixed(1)}x`,
    reference:  'Com més alt, més coixí patrimonial acumulat (orientatiu, no personalitzat per edat)',
    status: d.netWorthToIncomeRatio >= 2 ? 'verd' : d.netWorthToIncomeRatio >= 0.5 ? 'ambre' : 'vermell',
    explanation: 'Quantes vegades els teus ingressos anuals representa el patrimoni net que has acumulat fins ara.',
  });

  return ratios;
}

// ─── DIAGNÒSTIC I PRIORITATS ────────────────────────────────────────────────

function buildDiagnosis(
  q:        InvestorQuestionnaire,
  scoring:  ScoringResult,
  cashFlow: PersonalCashFlow,
  ratios:   PersonalRatio[],
): DiagnosisItem[] {
  const d = scoring.diagnostics;
  const items: DiagnosisItem[] = [];

  // Un ítem mecànic per cadascuna de les 5 ràtios: redactat com a punt
  // d'atenció si el semàfor no és verd, o com a punt fort si ho és.
  const debtRatio      = ratios.find(r => r.key === 'debtRatio')!;
  const emergencyFund  = ratios.find(r => r.key === 'emergencyFund')!;
  const savingsRate    = ratios.find(r => r.key === 'savingsRate')!;
  const netWorthRatio  = ratios.find(r => r.key === 'netWorthRatio')!;

  if (cashFlow.isDeficit) {
    items.push({
      status: 'vermell',
      headline: 'Les despeses anuals superen els ingressos.',
      detail: `Amb uns ingressos bruts de ${fmt(cashFlow.grossAnnualIncome)} i unes despeses de ${fmt(cashFlow.annualExpenses)}, el balanç anual és negatiu (${fmt(cashFlow.annualBalance)}).`,
    });
  } else {
    items.push({
      status: savingsRate.status,
      headline: savingsRate.status === 'verd'
        ? 'La capacitat d\'estalvi és sòlida.'
        : savingsRate.status === 'ambre'
        ? 'La capacitat d\'estalvi és millorable.'
        : 'La capacitat d\'estalvi és insuficient.',
      detail: `La taxa d\'estalvi actual és del ${d.savingsRate.toFixed(1)}% dels ingressos anuals.`,
    });
  }

  items.push({
    status: debtRatio.status,
    headline: debtRatio.status === 'verd'
      ? 'El nivell d\'endeutament és baix.'
      : debtRatio.status === 'ambre'
      ? 'El nivell de deute és moderat i convé vigilar-lo.'
      : 'El nivell de deute és elevat en relació als ingressos.',
    detail: `El deute total representa el ${d.debtToIncomeRatio.toFixed(1)}% dels ingressos anuals bruts (referència: menys del 35%).`,
  });

  items.push({
    status: emergencyFund.status,
    headline: emergencyFund.status === 'verd'
      ? 'El fons d\'emergència és sòlid.'
      : emergencyFund.status === 'ambre'
      ? 'El fons d\'emergència és millorable.'
      : 'El fons d\'emergència és insuficient.',
    detail: `Els estalvis actuals cobririen ${d.emergencyFundMonths.toFixed(1)} mesos de despeses; la referència habitual és de 3 a 6 mesos.`,
  });

  items.push({
    status: netWorthRatio.status,
    headline: netWorthRatio.status === 'verd'
      ? 'El patrimoni net acumulat és sòlid respecte als ingressos.'
      : netWorthRatio.status === 'ambre'
      ? 'El patrimoni net acumulat és moderat respecte als ingressos.'
      : 'El patrimoni net acumulat és baix respecte als ingressos.',
    detail: `El patrimoni net equival a ${d.netWorthToIncomeRatio.toFixed(1)} vegades els ingressos anuals bruts.`,
  });

  // Prioritat: vermell > ambre > verd. Sempre entre 3 i 5 conclusions,
  // ja que cada ràtio calculada aporta com a màxim una conclusió.
  const order: Record<RatioStatus, number> = { vermell: 0, ambre: 1, verd: 2 };
  return items
    .sort((a, b) => order[a.status] - order[b.status])
    .slice(0, 5);
}

// ─── UTILS ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('ca-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);
}

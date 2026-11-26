// lib/budget.ts
// Pas 1 de la beta: ordenar les finances abans d'invertir.
// Pressupost mensual + fons d'emergència a partir de les dades de la plantilla
// Excel (v2). Bloc descriptiu: no recomana cap producte.
//
// Fonts:
// - Regla 50/30/20 (E. Warren i A. W. Tyagi, "All Your Worth", 2005):
//   ≤50 % necessitats (fixes + deutes), ≤30 % desitjos (variables), ≥20 % estalvi.
// - Fons d'emergència: 6 mesos de despeses per a assalariats indefinits i 12
//   per a autònoms (criteri usat a les sessions presencials de FACTOR OTC, 2026).
//   Supòsit nostre: contracte temporal o sense feina = ingressos poc estables → 12.
//
// No inventa dades: si falten els ingressos (sou net i altres) retorna null.
// Ingressos = sou net mensual + altres ingressos mensuals (Excel v5).

export type EmploymentType = 'indefinit' | 'temporal' | 'autonom' | 'sense-feina';
export type BudgetStatus = 'verd' | 'ambre' | 'vermell';
export type NextStep = 'reduir-despeses' | 'fons-emergencia' | 'llest-per-invertir';

export interface BudgetInput {
  monthlyNetIncome?:        number;
  /** Altres ingressos nets al mes que no són el sou (Excel v5): extres, lloguers… */
  monthlyOtherIncome?:      number;
  monthlyFixedExpenses?:    number;
  monthlyVariableExpenses?: number;
  monthlyDebtPayments?:     number;
  /** Fallback si no hi ha desglossament fixes/variables (plantilla v1 o qüestionari) */
  monthlyExpenses?:         number;
  currentSavings?:          number;
  employmentType?:          string;
}

export interface BudgetLine { key: 'fixes' | 'deutes' | 'variables' | 'marge'; label: string; amount: number; pct: number }

export interface BudgetAnalysis {
  income:        number;          // total: sou net + altres ingressos
  salaryIncome:  number | null;   // part que és el sou net mensual
  otherIncome:   number;          // altres ingressos mensuals (0 si no n'hi ha)
  lines:         BudgetLine[];
  totalSpending: number;
  freeMargin:    number;           // pot ser negatiu
  savingsRate:   number;           // % dels ingressos nets
  hasBreakdown:  boolean;          // false si només hi ha despesa total
  checks: { key: string; label: string; value: string; reference: string; status: BudgetStatus }[];
  emergency: {
    monthsTarget:   number;
    targetAmount:   number;
    current:        number | null; // null si no sabem l'estalvi
    gap:            number | null;
    progressPct:    number | null;
    monthsToTarget: number | null; // destinant-hi tot el marge lliure
    basis:          string;        // per què 6 o 12 mesos
  };
  nextStep: NextStep;
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Mesos de fons d'emergència segons estabilitat d'ingressos. */
export function emergencyMonths(employment?: string): { months: number; basis: string } {
  switch (employment) {
    case 'indefinit':   return { months: 6,  basis: 'Contracte indefinit: 6 mesos de despeses.' };
    case 'autonom':     return { months: 12, basis: 'Autònom: 12 mesos, perquè els ingressos varien.' };
    case 'temporal':    return { months: 12, basis: 'Contracte temporal: 12 mesos, perquè els ingressos no són estables.' };
    case 'sense-feina': return { months: 12, basis: 'Sense feina: 12 mesos, perquè no hi ha ingressos estables.' };
    default:            return { months: 6,  basis: 'Situació laboral no indicada: es pren 6 mesos per defecte.' };
  }
}

/**
 * Ingressos totals al mes = sou net mensual + altres ingressos (extres, lloguers…).
 * null si no se'n sap cap dels dos (no s'inventa res).
 */
export function totalMonthlyIncome(q: Pick<BudgetInput, 'monthlyNetIncome' | 'monthlyOtherIncome'>): number | null {
  const net = typeof q.monthlyNetIncome === 'number' && Number.isFinite(q.monthlyNetIncome) ? q.monthlyNetIncome : null;
  const other = typeof q.monthlyOtherIncome === 'number' && Number.isFinite(q.monthlyOtherIncome) ? q.monthlyOtherIncome : null;
  if (net === null && other === null) return null;
  return (net ?? 0) + (other ?? 0);
}

export function analyzeBudget(q: BudgetInput): BudgetAnalysis | null {
  const income = totalMonthlyIncome(q);
  if (income === null || income <= 0) return null;
  const otherIncome = q.monthlyOtherIncome && q.monthlyOtherIncome > 0 ? q.monthlyOtherIncome : 0;

  // Desglossament només si hi ha fixes I variables: una categoria buida és
  // "no ho sé", no zero. Si falta, es fa servir la despesa total; sense total
  // no es pot calcular (s'infravaloraria la despesa).
  const hasBreakdown = q.monthlyFixedExpenses !== undefined && q.monthlyVariableExpenses !== undefined;
  if (!hasBreakdown && q.monthlyExpenses === undefined) return null;
  const fixed    = hasBreakdown ? q.monthlyFixedExpenses! : q.monthlyExpenses!;
  const variable = hasBreakdown ? q.monthlyVariableExpenses! : 0;
  const debt     = q.monthlyDebtPayments ?? 0;

  const totalSpending = fixed + variable + debt;
  const freeMargin = income - totalSpending;
  const pct = (n: number) => round((n / income) * 100);

  const lines: BudgetLine[] = [
    { key: 'fixes',     label: hasBreakdown ? 'Despeses fixes' : 'Despeses (total)', amount: fixed, pct: pct(fixed) },
    { key: 'deutes',    label: 'Quotes de deutes',  amount: debt,     pct: pct(debt) },
    { key: 'variables', label: 'Despeses variables', amount: variable, pct: pct(variable) },
    { key: 'marge',     label: 'Marge per estalviar', amount: freeMargin, pct: pct(freeMargin) },
  ];
  const savingsRate = pct(freeMargin);

  const checks: BudgetAnalysis['checks'] = [];
  if (hasBreakdown) {
    const needs = pct(fixed + debt);
    checks.push({ key: 'needs', label: 'Necessitats (fixes + deutes)', value: `${needs}%`, reference: '≤ 50 %',
      status: needs <= 50 ? 'verd' : needs <= 60 ? 'ambre' : 'vermell' });
    const wants = pct(variable);
    checks.push({ key: 'wants', label: 'Despeses variables', value: `${wants}%`, reference: '≤ 30 %',
      status: wants <= 30 ? 'verd' : wants <= 40 ? 'ambre' : 'vermell' });
  }
  checks.push({ key: 'savings', label: 'Taxa d\'estalvi', value: `${savingsRate}%`, reference: '≥ 20 %',
    status: savingsRate >= 20 ? 'verd' : savingsRate >= 10 ? 'ambre' : 'vermell' });

  const { months, basis } = emergencyMonths(q.employmentType);
  // El coixí cobreix el que cal pagar cada mes: fixes, deutes i variables.
  const targetAmount = Math.round(totalSpending * months);
  const current = q.currentSavings ?? null;
  const gap = current === null ? null : Math.max(0, targetAmount - current);
  const progressPct = current === null || targetAmount === 0 ? null : Math.min(100, round((current / targetAmount) * 100, 0));
  const monthsToTarget = gap === null ? null : gap === 0 ? 0 : freeMargin > 0 ? Math.ceil(gap / freeMargin) : null;

  const nextStep: NextStep = freeMargin <= 0 ? 'reduir-despeses'
    : gap === null || gap > 0 ? 'fons-emergencia'
    : 'llest-per-invertir';

  return {
    income, salaryIncome: q.monthlyNetIncome ?? null, otherIncome, lines, totalSpending, freeMargin, savingsRate, hasBreakdown, checks,
    emergency: { monthsTarget: months, targetAmount, current, gap, progressPct, monthsToTarget, basis },
    nextStep,
  };
}

export const NEXT_STEP_TEXT: Record<NextStep, { title: string; detail: string }> = {
  'reduir-despeses':    { title: 'Pas 1: equilibrar el pressupost', detail: 'Les despeses igualen o superen els ingressos. Abans de res, cal trobar marge mensual.' },
  'fons-emergencia':    { title: 'Pas 2: completar el fons d\'emergència', detail: 'Hi ha marge cada mes, però el coixí encara no cobreix els mesos de referència.' },
  'llest-per-invertir': { title: 'Pas 3: començar a invertir', detail: 'Pressupost amb marge i fons d\'emergència complet. Es pot passar a la proposta de cartera.' },
};

/** Camps que pinta "Les meves finances". La resta del qüestionari no s'exposa al portal. */
export const FINANCE_FIELDS = [
  'monthlyNetIncome', 'monthlyOtherIncome', 'monthlyFixedExpenses', 'monthlyVariableExpenses', 'monthlyDebtPayments',
  'monthlyExpenses', 'currentSavings', 'employmentType', 'goals', 'oneOffExpenses',
] as const;

export function pickFinanceFields(q?: Record<string, unknown> | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!q) return out;
  for (const k of FINANCE_FIELDS) if (q[k] !== undefined) out[k] = q[k];
  return out;
}

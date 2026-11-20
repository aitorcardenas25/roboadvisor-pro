// lib/goalProgress.ts
// Progrés cap als objectius del client ("Pis: 12.000 de 30.000 €, vas bé").
//
// Regles (les mateixes que lib/diagnosis.ts, perquè les xifres quadrin):
// - Només estalvi, al 0 %: no es compta cap rendiment, per no prometre res.
// - Diners que compten: liquiditat + inversions del patrimoni consolidat.
//   Els immobles i "altres" no (no es poden fer servir per a un objectiu
//   sense vendre'ls). Els deutes ja es paguen amb les quotes del pressupost.
// - Primer el coixí d'emergència (lib/budget.ts: 6 o 12 mesos de despeses):
//   es reserva abans de repartir res als objectius, i mentre no està complet
//   el marge mensual va al coixí.
// - Els objectius es financen per ordre de data (el més proper primer),
//   tant amb els diners que ja té com amb el marge mensual que li queda.
//   És un "pressupost per objectius" (goals-based budgeting; vegeu
//   Brunel, J. (2015) "Goals-Based Wealth Management", Wiley, cap. 3).
// - "Vas bé" vol dir: el que et falta, repartit entre els mesos que queden,
//   cap dins del marge que et queda després dels objectius anteriors.
import { analyzeBudget, type BudgetInput } from './budget';

export type GoalStatus = 'assolit' | 'va-be' | 'cal-ajustar' | 'vencut' | 'sense-dades';

export interface GoalInput { horizon?: string; description: string; amount?: number; targetYear?: number }

export interface GoalProgress {
  description: string;
  targetYear:  number | null;
  amount:      number | null;
  /** Part dels diners que ja té assignada a aquest objectiu */
  saved:       number;
  /** 0-100, null si l'objectiu no té import */
  progressPct: number | null;
  missing:     number | null;
  monthsLeft:  number | null;
  /** Estalvi mensual que cal per arribar-hi a temps (0 % de rendiment) */
  monthlyNeeded: number | null;
  status:      GoalStatus;
  message:     string;
}

export interface GoalsSummary {
  goals:            GoalProgress[];
  /** Liquiditat + inversions */
  available:        number;
  /** Reservat per al coixí d'emergència */
  cushionReserved:  number;
  cushionTarget:    number | null;
  /** Marge lliure mensual del pressupost (null si no el sabem) */
  monthlyMargin:    number | null;
  assumptions:      string[];
}

const eur = (n: number) => `${Math.round(n).toLocaleString('ca-ES')} €`;

/** Mesos fins a l'any objectiu (mateix càlcul que lib/diagnosis.ts). */
function monthsUntil(targetYear: number, now: Date): number {
  return (targetYear - now.getUTCFullYear()) * 12;
}

export function goalsProgress(input: {
  goals:     GoalInput[] | undefined | null;
  budget:    BudgetInput;
  /** Liquiditat + inversions del patrimoni consolidat */
  available: number;
  now?:      Date;
}): GoalsSummary {
  const now = input.now ?? new Date();
  const year = now.getUTCFullYear();
  const a = analyzeBudget(input.budget);
  const available = Math.max(0, input.available);

  // 1. Coixí d'emergència primer
  const cushionTarget = a ? a.emergency.targetAmount : null;
  const cushionReserved = cushionTarget === null ? 0 : Math.min(available, cushionTarget);
  const cushionGap = cushionTarget === null ? 0 : cushionTarget - cushionReserved;
  let capital = available - cushionReserved;

  const margin = a ? a.freeMargin : null;
  // Mesos que el marge va al coixí abans de poder anar als objectius
  const cushionMonths = cushionGap > 0 && margin !== null && margin > 0 ? Math.ceil(cushionGap / margin) : cushionGap > 0 ? Infinity : 0;
  let capacity = margin !== null ? Math.max(0, margin) : 0;

  const valid = (input.goals ?? []).filter(g => g?.description?.trim());
  // Ordre: primer els que tenen any (el més proper primer), després la resta
  const ordered = [...valid].sort((x, y) => (x.targetYear ?? 9999) - (y.targetYear ?? 9999));

  const goals: GoalProgress[] = ordered.map(g => {
    const amount = g.amount && g.amount > 0 ? g.amount : null;
    const targetYear = g.targetYear ?? null;
    const base = { description: g.description.trim(), targetYear, amount };

    if (amount === null) {
      return { ...base, saved: 0, progressPct: null, missing: null, monthsLeft: null, monthlyNeeded: null,
        status: 'sense-dades' as const, message: 'Falta l\'import: afegeix-lo a "Les meves finances" per veure com vas.' };
    }

    const saved = Math.min(capital, amount);
    capital -= saved;
    const missing = Math.round((amount - saved) * 100) / 100;
    const progressPct = Math.min(100, Math.round((saved / amount) * 100));

    if (missing <= 0) {
      return { ...base, saved, progressPct: 100, missing: 0, monthsLeft: targetYear ? Math.max(0, monthsUntil(targetYear, now)) : null,
        monthlyNeeded: 0, status: 'assolit' as const, message: 'Ja tens els diners per a aquest objectiu.' };
    }
    if (targetYear === null) {
      return { ...base, saved, progressPct, missing, monthsLeft: null, monthlyNeeded: null,
        status: 'sense-dades' as const, message: `Et falten ${eur(missing)}. Afegeix l'any per saber si vas bé.` };
    }
    if (targetYear < year) {
      return { ...base, saved, progressPct, missing, monthsLeft: 0, monthlyNeeded: null,
        status: 'vencut' as const, message: `La data (${targetYear}) ja ha passat. Revisa l'objectiu a "Les meves finances".` };
    }
    const monthsLeft = Math.max(1, monthsUntil(targetYear, now));
    if (margin === null) {
      const need = missing / monthsLeft;
      return { ...base, saved, progressPct, missing, monthsLeft, monthlyNeeded: need,
        status: 'sense-dades' as const, message: `Cal estalviar uns ${eur(need)} al mes. Omple ingressos i despeses per saber si hi arribes.` };
    }
    const usefulMonths = monthsLeft - cushionMonths;
    if (usefulMonths <= 0) {
      return { ...base, saved, progressPct, missing, monthsLeft, monthlyNeeded: null,
        status: 'cal-ajustar' as const, message: 'Primer cal completar el coixí d\'emergència, i amb el marge actual no queda temps per a aquest objectiu. Cal més marge, més temps o un import més petit.' };
    }
    const need = missing / usefulMonths;
    if (need <= capacity + 0.005) {
      capacity -= need;
      return { ...base, saved, progressPct, missing, monthsLeft, monthlyNeeded: need,
        status: 'va-be' as const, message: `Vas bé: amb ${eur(need)} al mes${cushionMonths > 0 ? ' (un cop completat el coixí)' : ''} hi arribes el ${targetYear}.` };
    }
    const short = need - capacity;
    capacity = 0;
    return { ...base, saved, progressPct, missing, monthsLeft, monthlyNeeded: need,
      status: 'cal-ajustar' as const,
      message: `Cal estalviar ${eur(need)} al mes i ara et queden ${eur(need - short)}. Et falten uns ${eur(short)} al mes: més marge, més temps o un import més petit.` };
  });

  const assumptions = [
    'Només compta l\'estalvi: no suposem cap rendiment de les inversions.',
    'Compten els comptes, dipòsits i inversions; no els immobles.',
    cushionTarget !== null
      ? `Primer es reserva el coixí d'emergència (${eur(cushionTarget)}).`
      : 'Sense ingressos i despeses no podem calcular el coixí d\'emergència ni el teu marge.',
    'Els objectius es cobreixen per ordre de data, el més proper primer.',
  ];

  return { goals, available, cushionReserved, cushionTarget, monthlyMargin: margin, assumptions };
}

/** Liquiditat + inversions d'un patrimoni consolidat (lib/wealth.ts). */
export function availableForGoals(groups: { group: string; value: number }[]): number {
  return groups.filter(g => g.group === 'liquiditat' || g.group === 'inversions').reduce((s, g) => s + g.value, 0);
}

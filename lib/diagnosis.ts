// lib/diagnosis.ts
// Diagnòstic automàtic d'un client: en una pantalla, on és, què és el més
// important i què pot fer aquest mes, amb xifres seves.
// Es calcula cada cop que es mostren les dades (al moment, sense esperar l'assessor).
//
// Regles:
// - Descriptiu: no recomana cap producte ni suposa cap rendiment. Els objectius
//   es calculen al 0 % (només estalvi), per no prometre res.
// - Fa servir lib/budget.ts (50/30/20 de Warren i Tyagi 2005 i fons d'emergència).
// - Màxim 3 punts clau i 3 accions, ordenades per prioritat.
import { analyzeBudget, type BudgetAnalysis, type BudgetInput } from './budget';

export type DiagnosisStatus = 'vermell' | 'ambre' | 'verd' | 'incomplet';
export type Tone = 'bo' | 'atencio' | 'alerta' | 'neutre';

export interface DiagnosisGoal { horizon?: string; description: string; amount?: number; targetYear?: number }
export interface DiagnosisInput extends BudgetInput { goals?: DiagnosisGoal[] }

export interface Diagnosis {
  status:   DiagnosisStatus;
  headline: string;
  findings: { label: string; value: string; detail: string; tone: Tone }[];
  actions:  { title: string; detail: string }[];
  missing:  string[];
}

const eur = (n: number) => `${Math.round(n).toLocaleString('ca-ES')} €`;
const MONTHS_CA = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const pctCa = (v: string) => v.replace('.', ',');
const roundUp10 = (n: number) => Math.ceil(n / 10) * 10;

function monthLabel(now: Date, monthsAhead: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead, 1));
  return `${MONTHS_CA[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

function missingFields(q: DiagnosisInput): string[] {
  const m: string[] = [];
  if (!q.monthlyNetIncome) m.push('ingressos nets mensuals');
  const hasBreakdown = q.monthlyFixedExpenses !== undefined && q.monthlyVariableExpenses !== undefined;
  if (!hasBreakdown && q.monthlyExpenses === undefined) m.push('despeses mensuals');
  else if (!hasBreakdown) m.push('despeses separades en fixes i variables');
  if (q.currentSavings === undefined) m.push('estalvi que ja tens');
  if (!q.employmentType) m.push('situació laboral');
  if (!q.goals?.length) m.push('algun objectiu');
  return m;
}

/** Objectiu amb import i any més proper que encara no ha passat. */
function nearestGoal(goals: DiagnosisGoal[] | undefined, now: Date) {
  const y = now.getUTCFullYear();
  return (goals ?? [])
    .filter(g => g.amount && g.amount > 0 && g.targetYear && g.targetYear > y)
    .sort((a, b) => a.targetYear! - b.targetYear!)[0];
}

export function diagnose(q: DiagnosisInput, now = new Date()): Diagnosis {
  const missing = missingFields(q);
  const a = analyzeBudget(q);
  if (!a) {
    return {
      status: 'incomplet',
      headline: 'Falten dades per fer el diagnòstic.',
      findings: [],
      actions: [{ title: 'Omple les dades bàsiques', detail: `Cal com a mínim: ${missing.filter(f => f.startsWith('ingressos') || f.startsWith('despeses')).join(' i ')}. Amb això el diagnòstic surt al moment.` }],
      missing,
    };
  }
  return { ...build(a, q, now), missing };
}

function build(a: BudgetAnalysis, q: DiagnosisInput, now: Date): Omit<Diagnosis, 'missing'> {
  const e = a.emergency;
  const findings: Diagnosis['findings'] = [];
  const actions: Diagnosis['actions'] = [];
  const monthlyNeed = a.totalSpending;

  // 1 · Marge mensual
  findings.push({
    label: 'Et queda cada mes',
    value: eur(a.freeMargin),
    detail: `${pctCa(String(a.savingsRate))}% dels ingressos (referència: 20%)`,
    tone: a.freeMargin <= 0 ? 'alerta' : a.savingsRate >= 20 ? 'bo' : a.savingsRate >= 10 ? 'atencio' : 'alerta',
  });

  // 2 · Coixí d'emergència en mesos de despeses
  if (e.current !== null && monthlyNeed > 0) {
    const covered = Math.floor((e.current / monthlyNeed) * 10) / 10;
    findings.push({
      label: 'El teu coixí cobreix',
      value: `${covered.toLocaleString('ca-ES')} mesos`,
      detail: `de despeses (objectiu: ${e.monthsTarget} mesos, ${eur(e.targetAmount)})`,
      tone: e.gap === 0 ? 'bo' : covered >= e.monthsTarget / 2 ? 'atencio' : 'alerta',
    });
  } else {
    findings.push({ label: 'Fons d\'emergència', value: eur(e.targetAmount), detail: `objectiu de ${e.monthsTarget} mesos; falta saber quant estalvi tens`, tone: 'neutre' });
  }

  // 3 · El punt que més pesa
  const wants = a.checks.find(c => c.key === 'wants');
  const needs = a.checks.find(c => c.key === 'needs');
  const debt  = a.lines.find(l => l.key === 'deutes')!;
  const goal  = nearestGoal(q.goals, now);
  if (needs && needs.status !== 'verd') {
    findings.push({ label: 'Despeses fixes i deutes', value: pctCa(needs.value), detail: 'dels ingressos (referència: 50% o menys)', tone: needs.status === 'vermell' ? 'alerta' : 'atencio' });
  } else if (wants && wants.status !== 'verd') {
    findings.push({ label: 'Despeses variables', value: pctCa(wants.value), detail: 'dels ingressos (referència: 30% o menys)', tone: wants.status === 'vermell' ? 'alerta' : 'atencio' });
  } else if (debt.amount > 0) {
    findings.push({ label: 'Quotes de deutes', value: eur(debt.amount), detail: `${pctCa(String(debt.pct))}% dels ingressos cada mes`, tone: debt.pct > 15 ? 'atencio' : 'neutre' });
  } else if (goal) {
    const months = (goal.targetYear! - now.getUTCFullYear()) * 12;
    const need = goal.amount! / months;
    findings.push({ label: goal.description, value: `${eur(need)}/mes`, detail: `per tenir ${eur(goal.amount!)} el ${goal.targetYear}, només estalviant`, tone: need <= Math.max(0, a.freeMargin) ? 'bo' : 'atencio' });
  }

  // ── Accions, per ordre de prioritat ─────────────────────────────────────
  if (a.freeMargin <= 0) {
    const deficit = -a.freeMargin;
    const toTen = roundUp10(deficit + a.income * 0.1);
    actions.push({
      title: deficit > 0 ? `Retallar ${eur(roundUp10(deficit))} al mes` : 'Aconseguir marge cada mes',
      detail: `Ara gastes ${deficit > 0 ? 'més del' : 'tot el'} que ingresses. Amb ${eur(toTen)} menys de despesa estalviaries un 10% dels ingressos.`,
    });
    if (wants && a.hasBreakdown) {
      const variable = a.lines.find(l => l.key === 'variables')!.amount;
      if (variable > 0) actions.push({ title: 'Començar per les despeses variables', detail: `Són ${eur(variable)} al mes. Són les més fàcils de moure sense canviar contractes.` });
    }
  } else {
    if (wants && wants.status !== 'verd') {
      const variable = a.lines.find(l => l.key === 'variables')!.amount;
      const cut = roundUp10(variable - a.income * 0.3);
      if (cut > 0) actions.push({ title: `Baixar les despeses variables ${eur(cut)} al mes`, detail: `Passaries de ${pctCa(wants.value)} al 30% dels ingressos i et quedarien ${eur(a.freeMargin + cut)} cada mes.` });
    }
    if (e.gap === null) {
      actions.push({ title: 'Indicar quant estalvi tens', detail: `Sense aquesta dada no es pot saber si el coixí de ${e.monthsTarget} mesos (${eur(e.targetAmount)}) està complet.` });
    } else if (e.gap > 0) {
      const months = e.monthsToTarget!;
      actions.push({
        title: `Apartar ${eur(a.freeMargin)} al mes per al coixí`,
        detail: `Et falten ${eur(e.gap)}. A aquest ritme el tindries complet cap a ${monthLabel(now, months)} (${months} ${months === 1 ? 'mes' : 'mesos'}). Millor en un compte a part i sense risc.`,
      });
    }
    if (goal) {
      const months = (goal.targetYear! - now.getUTCFullYear()) * 12;
      const need = goal.amount! / months;
      const spare = e.gap && e.gap > 0 ? 0 : a.freeMargin;
      const ok = need <= spare;
      actions.push({
        title: `${goal.description}: ${eur(need)} al mes`,
        detail: e.gap && e.gap > 0
          ? `Per tenir ${eur(goal.amount!)} el ${goal.targetYear} cal aquesta quantitat cada mes, només estalviant. Primer el coixí; després el teu marge de ${eur(a.freeMargin)} hi pot anar.`
          : ok
            ? `Per tenir ${eur(goal.amount!)} el ${goal.targetYear}. Amb el teu marge de ${eur(a.freeMargin)} hi arribes només estalviant.`
            : `Per tenir ${eur(goal.amount!)} el ${goal.targetYear}. El teu marge és de ${eur(a.freeMargin)}: cal més marge, més temps o un import més petit.`,
      });
    }
    if (a.nextStep === 'llest-per-invertir') {
      actions.push({ title: 'Parlar amb l\'assessor del pas següent', detail: `Tens marge cada mes i el coixí complet. El que estalviïs a partir d'ara (${eur(a.freeMargin)} al mes) ja pot tenir un altre destí.` });
    }
  }

  const status: DiagnosisStatus = a.freeMargin <= 0 || a.savingsRate < 5 ? 'vermell'
    : a.nextStep === 'llest-per-invertir' && a.savingsRate >= 10 ? 'verd'
    : 'ambre';

  const headline =
    a.freeMargin < 0 ? `Gastes ${eur(-a.freeMargin)} al mes més del que ingresses. El primer és equilibrar-ho.`
    : a.freeMargin === 0 ? 'Gastes tot el que ingresses. El primer és trobar marge.'
    : e.gap === null ? `Et queden ${eur(a.freeMargin)} al mes. Falta saber quant estalvi tens per completar el diagnòstic.`
    : e.gap > 0 ? `Et queden ${eur(a.freeMargin)} al mes. La prioritat és completar el coixí d'emergència.`
    : `Pressupost amb marge (${eur(a.freeMargin)} al mes) i coixí complet. Bona base per al pas següent.`;

  return { status, headline, findings: findings.slice(0, 3), actions: actions.slice(0, 3) };
}

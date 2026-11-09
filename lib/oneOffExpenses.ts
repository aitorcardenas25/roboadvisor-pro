// lib/oneOffExpenses.ts
// Despeses puntuals (un viatge, un mòbil, un cotxe, un mes de més despesa
// variable). Les pot entrar el client o l'assessor. Per defecte surten de
// l'estalvi: es resta de currentSavings i el pressupost, el fons d'emergència
// i el diagnòstic es recalculen sols. Si s'esborra, l'estalvi es restitueix.
// Lògica pura: les rutes fan l'autenticació i la persistència.
import { z } from 'zod';
import { analyzeBudget, type BudgetInput } from './budget';

export const EXPENSE_CATEGORIES = {
  viatge:     'Viatge',
  tecnologia: 'Mòbil o tecnologia',
  cotxe:      'Cotxe o transport',
  casa:       'Casa',
  salut:      'Salut',
  variables:  'Més despesa variable del mes',
  altres:     'Altres',
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export interface OneOffExpense {
  id:             string;
  date:           string;         // AAAA-MM-DD
  description:    string;
  amount:         number;
  category:       ExpenseCategory;
  affectsSavings: boolean;
  /** Import realment restat de l'estalvi (pot ser menor si no n'hi havia prou) */
  deducted:       number;
  addedBy:        'client' | 'admin';
  createdAt:      string;
}

export const OneOffInputSchema = z.object({
  description:    z.string().trim().min(1, 'Descriu la despesa').max(120),
  amount:         z.number().finite().positive('L\'import ha de ser més gran que 0').max(1_000_000),
  category:       z.enum(Object.keys(EXPENSE_CATEGORIES) as [ExpenseCategory, ...ExpenseCategory[]]).default('altres'),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no vàlida').optional(),
  affectsSavings: z.boolean().default(true),
}).strict();
export type OneOffInput = z.infer<typeof OneOffInputSchema>;

const MAX_ENTRIES = 200;

function list(q: Record<string, unknown>): OneOffExpense[] {
  return Array.isArray(q.oneOffExpenses) ? (q.oneOffExpenses as OneOffExpense[]) : [];
}
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export interface ExpenseImpact {
  savingsBefore:   number | null;
  savingsAfter:    number | null;
  /** Mesos de despeses que cobreix l'estalvi, abans i després */
  cushionBefore:   number | null;
  cushionAfter:    number | null;
  /** Mesos per recuperar l'import apartant tot el marge mensual (null si no hi ha marge) */
  monthsToRecover: number | null;
  summary:         string;
}

const eur = (n: number) => `${Math.round(n).toLocaleString('ca-ES')} €`;
const months1 = (n: number) => (Math.floor(n * 10) / 10).toLocaleString('ca-ES');

function budgetInput(q: Record<string, unknown>): BudgetInput {
  return {
    monthlyNetIncome: num(q.monthlyNetIncome), monthlyFixedExpenses: num(q.monthlyFixedExpenses),
    monthlyVariableExpenses: num(q.monthlyVariableExpenses), monthlyDebtPayments: num(q.monthlyDebtPayments),
    monthlyExpenses: num(q.monthlyExpenses), currentSavings: num(q.currentSavings),
    employmentType: typeof q.employmentType === 'string' ? q.employmentType : undefined,
  };
}

export function expenseImpact(before: Record<string, unknown>, after: Record<string, unknown>, amount: number): ExpenseImpact {
  const a = analyzeBudget(budgetInput(after));
  const sb = num(before.currentSavings) ?? null;
  const sa = num(after.currentSavings) ?? null;
  const spend = a?.totalSpending ?? 0;
  const cushionBefore = sb !== null && spend > 0 ? sb / spend : null;
  const cushionAfter  = sa !== null && spend > 0 ? sa / spend : null;
  const monthsToRecover = a && a.freeMargin > 0 ? Math.ceil(amount / a.freeMargin) : null;

  const parts: string[] = [];
  if (sb !== null && sa !== null && sb !== sa) parts.push(`L'estalvi passa de ${eur(sb)} a ${eur(sa)}.`);
  if (cushionBefore !== null && cushionAfter !== null && cushionBefore !== cushionAfter) {
    parts.push(`El coixí cobreix ${months1(cushionAfter)} mesos de despeses (abans ${months1(cushionBefore)}).`);
  }
  if (monthsToRecover !== null) parts.push(`Apartant el marge de ${eur(a!.freeMargin)} al mes, es recupera en ${monthsToRecover} ${monthsToRecover === 1 ? 'mes' : 'mesos'}.`);
  else if (a && a.freeMargin <= 0) parts.push('Ara no hi ha marge mensual per recuperar-ho: cal revisar el pressupost.');
  if (!parts.length) parts.push('Despesa registrada.');

  return { savingsBefore: sb, savingsAfter: sa, cushionBefore, cushionAfter, monthsToRecover, summary: parts.join(' ') };
}

/** Afegeix la despesa i, si surt de l'estalvi, el redueix. No modifica `q`. */
export function addOneOff(
  q: Record<string, unknown> | null | undefined,
  input: OneOffInput,
  by: 'client' | 'admin',
  now = new Date(),
): { next: Record<string, unknown>; entry: OneOffExpense; impact: ExpenseImpact } {
  const before = { ...(q ?? {}) };
  const next: Record<string, unknown> = { ...before };
  const savings = num(before.currentSavings);
  const deducted = input.affectsSavings && savings !== undefined ? Math.min(savings, input.amount) : 0;
  if (deducted > 0) next.currentSavings = Math.round((savings! - deducted) * 100) / 100;

  const entry: OneOffExpense = {
    id: `exp-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    date: input.date ?? now.toISOString().slice(0, 10),
    description: input.description,
    amount: input.amount,
    category: input.category,
    affectsSavings: input.affectsSavings,
    deducted,
    addedBy: by,
    createdAt: now.toISOString(),
  };
  next.oneOffExpenses = [entry, ...list(before)].slice(0, MAX_ENTRIES);
  return { next, entry, impact: expenseImpact(before, next, input.amount) };
}

/** Esborra la despesa i torna a sumar a l'estalvi el que s'hi havia restat. */
export function removeOneOff(q: Record<string, unknown> | null | undefined, id: string): Record<string, unknown> | null {
  const before = { ...(q ?? {}) };
  const entries = list(before);
  const entry = entries.find(e => e.id === id);
  if (!entry) return null;
  const next: Record<string, unknown> = { ...before, oneOffExpenses: entries.filter(e => e.id !== id) };
  const savings = num(before.currentSavings);
  if (entry.deducted > 0 && savings !== undefined) next.currentSavings = Math.round((savings + entry.deducted) * 100) / 100;
  return next;
}

/** Total de despeses puntuals del mes natural que conté `now`. */
export function monthTotal(q: Record<string, unknown>, now = new Date()): number {
  const ym = now.toISOString().slice(0, 7);
  return list(q).filter(e => e.date.startsWith(ym)).reduce((s, e) => s + e.amount, 0);
}

// ── Dictat ─────────────────────────────────────────────────────────────────

const KEYWORDS: [ExpenseCategory, RegExp][] = [
  ['viatge',     /viatge|vacanc|vol\b|vols\b|hotel|escapada/i],
  ['tecnologia', /m[òo]bil|tel[eè]fon|ordinador|port[àa]til|tauleta|iphone|tablet/i],
  ['cotxe',      /cotxe|moto|taller|itv|benzina|ruedas|rodes|transport/i],
  ['casa',       /casa|pis|moble|nevera|rentadora|reforma|lloguer/i],
  ['salut',      /dentista|metge|salut|farm[àa]cia|[òo]ptica|ulleres/i],
  ['variables',  /variable|oci|sopars?|restaurant|roba|compres/i],
];

const WORD_NUMBERS: Record<string, number> = { mil: 1000, cent: 100, cents: 100, dos: 2, tres: 3, quatre: 4, cinc: 5, sis: 6, set: 7, vuit: 8, nou: 9, deu: 10 };

/**
 * Interpreta una frase dictada, p. ex. "s'ha gastat 1.000 euros en un mòbil".
 * Retorna import, descripció i categoria; null si no troba cap import.
 */
export function parseSpokenExpense(text: string): { amount: number; description: string; category: ExpenseCategory } | null {
  const t = text.trim();
  // 1.000 / 1 000 / 1000,50 / 300€
  const m = t.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,(\d{1,2}))?\s*(?:€|euros?|eur\b)?/i);
  let amount: number | null = null;
  let rest = t;
  if (m) {
    amount = Number(m[1].replace(/[.\s]/g, '')) + (m[2] ? Number(m[2]) / 10 ** m[2].length : 0);
    // "5 mil" → 5000
    const after = t.slice((m.index ?? 0) + m[0].length).trimStart();
    if (/^mil\b/i.test(after)) { amount *= 1000; rest = t.replace(m[0], '').replace(/\bmil\b/i, ''); }
    else rest = t.replace(m[0], '');
  } else {
    const w = t.toLowerCase().match(/\b(dos|tres|quatre|cinc|sis|set|vuit|nou|deu)?\s*mil\b/);
    if (w) { amount = (w[1] ? WORD_NUMBERS[w[1]] : 1) * 1000; rest = t.replace(w[0], ''); }
  }
  if (!amount || amount <= 0) return null;

  const category = KEYWORDS.find(([, re]) => re.test(t))?.[0] ?? 'altres';
  let description = rest
    .replace(/\b(euros?|€)\b/gi, '')
    .replace(/^(s'ha|m'he|he|ha|hem|han)\s+(gastat|pagat|comprat)\s*/i, '')
    .replace(/^(gastat|pagat|comprat)\s*/i, '')
    .replace(/^\s*(en|amb|per|d'|de)\s+(un|una|uns|unes|el|la|els|les)?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!description) description = EXPENSE_CATEGORIES[category];
  description = description.charAt(0).toUpperCase() + description.slice(1);
  return { amount: Math.round(amount * 100) / 100, description: description.slice(0, 120), category };
}

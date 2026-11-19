// lib/onboarding.ts
// Primers passos del client al portal de la beta (3 passos).
// Només descriu en quin punt és el client; no calcula res financer.
import { PERSONAL_FIELDS, CHOICE_FIELDS } from './clientImport';

export type StepState = 'fet' | 'en-curs' | 'pendent';
export type StepId = 'dades' | 'proposta' | 'seguiment';

export interface OnboardingStep { id: StepId; state: StepState }
export interface OnboardingStatus {
  steps: OnboardingStep[];
  /** Tots els passos fets: la guia ja no cal a la portada. */
  complete: boolean;
}

export interface OnboardingInput {
  questionnaireData?: Record<string, unknown> | null;
  /** Estat de la proposta més nova, si n'hi ha. */
  latestProposal?: 'draft' | 'approved' | null;
  /** Nombre de posicions de la cartera activa. */
  holdings: number;
}

const DATA_KEYS: string[] = [
  ...PERSONAL_FIELDS.map(f => f.key), ...CHOICE_FIELDS.map(f => f.key),
];

/** El client ja ha donat alguna dada útil (Excel o formulari de "Les meves finances"). */
export function hasClientData(q?: Record<string, unknown> | null): boolean {
  if (!q) return false;
  if (DATA_KEYS.some(k => q[k] !== undefined && q[k] !== null && q[k] !== '')) return true;
  return Array.isArray(q.goals) && q.goals.length > 0;
}

export function onboardingStatus(i: OnboardingInput): OnboardingStatus {
  const data = hasClientData(i.questionnaireData);
  const portfolio = i.holdings > 0;
  // Una cartera activa implica que la proposta ja s'ha fet, encara que no consti.
  const proposalDone = portfolio || i.latestProposal === 'approved';
  const steps: OnboardingStep[] = [
    { id: 'dades',     state: data || portfolio ? 'fet' : 'en-curs' },
    { id: 'proposta',  state: proposalDone ? 'fet' : (data || i.latestProposal === 'draft') ? 'en-curs' : 'pendent' },
    { id: 'seguiment', state: portfolio ? 'fet' : proposalDone ? 'en-curs' : 'pendent' },
  ];
  return { steps, complete: steps.every(s => s.state === 'fet') };
}

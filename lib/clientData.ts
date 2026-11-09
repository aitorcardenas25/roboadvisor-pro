// lib/clientData.ts
// Dades que el client gestiona ell mateix des del portal (sense Excel) i
// exportació de les seves dades (RGPD art. 15 accés i art. 20 portabilitat).
// Lògica pura: les rutes d'API fan l'autenticació i la persistència.
import { z } from 'zod';

const MAX_EUR = 10_000_000;
// null = esborrar el camp ("no ho sé"); undefined = no tocar-lo.
const money = z.number().finite().min(0, 'Ha de ser 0 o més').max(MAX_EUR, 'Import massa gran').nullable().optional();

export const GoalSchema = z.object({
  horizon:     z.enum(['curt', 'mitja', 'llarg']),
  description: z.string().trim().min(1, 'Descriu l\'objectiu').max(200),
  amount:      z.number().finite().min(0).max(MAX_EUR).optional(),
  targetYear:  z.number().int().min(2000).max(2100).optional(),
});

export const FinanceUpdateSchema = z.object({
  monthlyNetIncome:        money,
  monthlyFixedExpenses:    money,
  monthlyVariableExpenses: money,
  monthlyDebtPayments:     money,
  currentSavings:          money,
  employmentType:          z.enum(['indefinit', 'temporal', 'autonom', 'sense-feina']).nullable().optional(),
  goals:                   z.array(GoalSchema).max(10, 'Màxim 10 objectius').optional(),
}).strict();

export type FinanceUpdate = z.infer<typeof FinanceUpdateSchema>;

/**
 * Aplica els canvis del client sobre el qüestionari existent sense perdre la
 * resta de camps (perfil de risc, coneixements, etc.). null esborra el camp.
 * Si el client envia el desglossament fixes + variables, el total antic
 * (monthlyExpenses, plantilla v1) deixa de tenir sentit i s'elimina.
 */
export function applyFinanceUpdate(existing: Record<string, unknown> | null | undefined, update: FinanceUpdate): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(existing ?? {}) };
  for (const [k, v] of Object.entries(update)) {
    if (v === undefined) continue;
    if (v === null) delete out[k];
    else out[k] = v;
  }
  if (typeof out.monthlyFixedExpenses === 'number' && typeof out.monthlyVariableExpenses === 'number') {
    delete out.monthlyExpenses;
  }
  return out;
}

/** Fitxer JSON amb totes les dades del client. */
export function buildDataExport(parts: {
  account:   Record<string, unknown> | null;
  profile:   Record<string, unknown> | null;
  portfolio: unknown;
  proposals: unknown[];
  consent?:  unknown;
  now?:      Date;
}) {
  return {
    exportedAt: (parts.now ?? new Date()).toISOString(),
    service:    'Factor OTC',
    note:       'Còpia de les teves dades personals (RGPD, art. 15 i 20). Per corregir-les o esborrar-les, escriu a privacitat@factorotc.com o fes-ho des de "Les meves finances".',
    account:    parts.account,
    profile:    parts.profile,
    portfolio:  parts.portfolio ?? null,
    proposals:  parts.proposals,
    consent:    parts.consent ?? null,
  };
}

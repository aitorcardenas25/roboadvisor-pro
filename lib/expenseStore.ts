// lib/expenseStore.ts
// Desa i esborra despeses puntuals a la fitxa (lead.questionnaireData) d'un usuari.
// Compartit per la ruta del client i la de l'admin.
import { findLeadForUser, createLead, saveLeadQuestionnaire } from './leads';
import { findUserById } from './users';
import { addOneOff, removeOneOff, type OneOffInput, type OneOffExpense, type ExpenseImpact } from './oneOffExpenses';
import { pickFinanceFields } from './budget';

export type StoreResult =
  | { ok: true; data: Record<string, unknown>; entry?: OneOffExpense; impact?: ExpenseImpact; leadId: string }
  | { ok: false; status: number; error: string };

export async function addExpenseForUser(userId: string, email: string | null | undefined, input: OneOffInput, by: 'client' | 'admin'): Promise<StoreResult> {
  let lead = await findLeadForUser(userId, email);
  if (!lead) {
    const account = await findUserById(userId);
    const mail = account?.email ?? email;
    if (!mail) return { ok: false, status: 400, error: 'El compte no té correu electrònic' };
    lead = await createLead({ name: account?.name ?? mail, email: mail, interest: 'finances', source: by === 'admin' ? 'admin' : 'client-portal' });
  }
  const { next, entry, impact } = addOneOff(lead.questionnaireData, input, by);
  if (!(await saveLeadQuestionnaire(lead.id, next))) return { ok: false, status: 500, error: 'No s\'ha pogut desar' };
  return { ok: true, data: pickFinanceFields(next), entry, impact, leadId: lead.id };
}

export async function removeExpenseForUser(userId: string, email: string | null | undefined, id: string): Promise<StoreResult> {
  const lead = await findLeadForUser(userId, email);
  if (!lead) return { ok: false, status: 404, error: 'Fitxa no trobada' };
  const next = removeOneOff(lead.questionnaireData, id);
  if (!next) return { ok: false, status: 404, error: 'Despesa no trobada' };
  if (!(await saveLeadQuestionnaire(lead.id, next))) return { ok: false, status: 500, error: 'No s\'ha pogut desar' };
  return { ok: true, data: pickFinanceFields(next), leadId: lead.id };
}

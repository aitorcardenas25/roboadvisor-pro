// lib/wealthStore.ts
// Desa els elements de patrimoni (comptes, dipòsits, immobles, deutes...) a la
// fitxa del client (lead.questionnaireData.wealthItems) i construeix la vista
// consolidada. Compartit per la ruta del client i la de l'admin.
import { findLeadForUser, createLead, saveLeadQuestionnaire } from './leads';
import { findUserById } from './users';
import { computeMetrics, getPortfolioByClientId } from './clientPortfolios';
import { loadValuation } from './portfolioExcel';
import type { Valuation } from './portfolioValuation';
import { addItem, updateItem, removeItem, listItems, consolidateWealth, type WealthItemInput, type ConsolidatedWealth, type WealthItem } from './wealth';

export interface WealthPayload { wealth: ConsolidatedWealth; items: WealthItem[]; hasPortfolio: boolean }

export async function buildWealthForUser(userId: string, email?: string | null): Promise<WealthPayload> {
  const [lead, portfolio] = await Promise.all([findLeadForUser(userId, email), getPortfolioByClientId(userId)]);
  let valuation: Valuation | null = null;
  if (portfolio?.holdings.length) {
    try { valuation = await loadValuation(portfolio); }
    catch (err) { console.error('[wealth] valoració amb preus oficials:', err instanceof Error ? err.message : err); }
  }
  const wealth = consolidateWealth({
    holdings: portfolio?.holdings ?? [],
    netContributed: portfolio ? computeMetrics(portfolio).totalInvested : 0,
    valuation,
    questionnaire: lead?.questionnaireData ?? null,
  });
  return { wealth, items: listItems(lead?.questionnaireData), hasPortfolio: !!portfolio };
}

type Result = { ok: true; leadId: string } | { ok: false; status: number; error: string };

async function leadFor(userId: string, email: string | null | undefined, by: 'client' | 'admin') {
  const lead = await findLeadForUser(userId, email);
  if (lead) return lead;
  const account = await findUserById(userId);
  const mail = account?.email ?? email;
  if (!mail) return null;
  return createLead({ name: account?.name ?? mail, email: mail, interest: 'finances', source: by === 'admin' ? 'admin' : 'client-portal' });
}

export async function addWealthItemForUser(userId: string, email: string | null | undefined, input: WealthItemInput, by: 'client' | 'admin'): Promise<Result> {
  const lead = await leadFor(userId, email, by);
  if (!lead) return { ok: false, status: 400, error: 'El compte no té correu electrònic' };
  const r = addItem(lead.questionnaireData, input, by);
  if ('error' in r) return { ok: false, status: 400, error: r.error };
  if (!(await saveLeadQuestionnaire(lead.id, r.next))) return { ok: false, status: 500, error: 'No s\'ha pogut desar' };
  return { ok: true, leadId: lead.id };
}

export async function updateWealthItemForUser(userId: string, email: string | null | undefined, id: string, input: WealthItemInput): Promise<Result> {
  const lead = await findLeadForUser(userId, email);
  if (!lead) return { ok: false, status: 404, error: 'Fitxa no trobada' };
  const next = updateItem(lead.questionnaireData, id, input);
  if (!next) return { ok: false, status: 404, error: 'Element no trobat' };
  if (!(await saveLeadQuestionnaire(lead.id, next))) return { ok: false, status: 500, error: 'No s\'ha pogut desar' };
  return { ok: true, leadId: lead.id };
}

export async function removeWealthItemForUser(userId: string, email: string | null | undefined, id: string): Promise<Result> {
  const lead = await findLeadForUser(userId, email);
  if (!lead) return { ok: false, status: 404, error: 'Fitxa no trobada' };
  const next = removeItem(lead.questionnaireData, id);
  if (!next) return { ok: false, status: 404, error: 'Element no trobat' };
  if (!(await saveLeadQuestionnaire(lead.id, next))) return { ok: false, status: 500, error: 'No s\'ha pogut desar' };
  return { ok: true, leadId: lead.id };
}

// lib/proposals.ts
// Persistència de les propostes de cartera (versions, esborrany / aprovada).
// Tipus i càlculs: lib/proposalMath.ts.

import { getDb } from './supabase';
import { validateForApproval, type ClientProposal, type ProposalItem, type ProposalParams, type ProposalStatus } from './proposalMath';

export * from './proposalMath';

// ─── Persistència (Supabase o memòria) ────────────────────────────────────────

const _mem: ClientProposal[] = [];
const rid = () => globalThis.crypto.randomUUID().slice(0, 8);

function rowToProposal(r: Record<string, unknown>): ClientProposal {
  const d = (r.data ?? {}) as Omit<ClientProposal, 'id' | 'clientId' | 'version' | 'status' | 'createdAt' | 'updatedAt' | 'approvedAt' | 'approvedBy'>;
  return {
    ...d,
    id: r.id as string, clientId: r.client_id as string, version: Number(r.version),
    status: r.status as ProposalStatus,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    approvedAt: (r.approved_at as string) ?? undefined, approvedBy: (r.approved_by as string) ?? undefined,
  };
}

function dataOf(p: ClientProposal) {
  const { profile, objective, horizon, initialAmount, monthlyAmount, adminNote, items } = p;
  return { profile, objective, horizon, initialAmount, monthlyAmount, adminNote, items };
}

/** Totes les versions d'un client, de la més nova a la més antiga. */
export async function getProposals(clientId: string): Promise<ClientProposal[]> {
  const db = getDb();
  if (!db) return _mem.filter(p => p.clientId === clientId).sort((a, b) => b.version - a.version).map(p => structuredClone(p));
  const { data, error } = await db.from('client_proposals').select('*').eq('client_id', clientId).order('version', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => rowToProposal(r as Record<string, unknown>));
}

export async function getProposal(clientId: string, id: string): Promise<ClientProposal | null> {
  return (await getProposals(clientId)).find(p => p.id === id) ?? null;
}

/**
 * Desa l'esborrany del client. Si l'última versió és un esborrany, el
 * sobreescriu; si està aprovada (o no n'hi ha cap), crea una versió nova.
 */
export async function saveDraft(clientId: string, input: ProposalParams & { items: ProposalItem[] }): Promise<ClientProposal> {
  const now = new Date().toISOString();
  const all = await getProposals(clientId);
  const latest = all[0];
  const db = getDb();

  if (latest?.status === 'draft') {
    const updated: ClientProposal = { ...latest, ...input, updatedAt: now };
    if (!db) {
      const i = _mem.findIndex(p => p.id === latest.id);
      _mem[i] = structuredClone(updated);
      return updated;
    }
    const { error } = await db.from('client_proposals').update({ data: dataOf(updated), updated_at: now }).eq('id', latest.id);
    if (error) throw new Error(error.message);
    return updated;
  }

  const created: ClientProposal = {
    ...input, id: `prop-${Date.now()}-${rid()}`, clientId,
    version: (latest?.version ?? 0) + 1, status: 'draft', createdAt: now, updatedAt: now,
  };
  if (!db) { _mem.push(structuredClone(created)); return created; }
  const { error } = await db.from('client_proposals').insert({
    id: created.id, client_id: clientId, version: created.version, status: 'draft',
    data: dataOf(created), created_at: now, updated_at: now,
  });
  if (error) throw new Error(error.message);
  return created;
}

export type ApproveResult = { ok: true; proposal: ClientProposal } | { ok: false; error: string };

/** Aprova l'esborrany: queda congelat i es pot generar l'informe. */
export async function approveProposal(clientId: string, id: string, approvedBy: string): Promise<ApproveResult> {
  const p = await getProposal(clientId, id);
  if (!p) return { ok: false, error: 'Proposta no trobada' };
  if (p.status !== 'draft') return { ok: false, error: 'Aquesta versió ja està aprovada' };
  const problem = validateForApproval(p);
  if (problem) return { ok: false, error: problem };

  const now = new Date().toISOString();
  const approved: ClientProposal = { ...p, status: 'approved', approvedAt: now, approvedBy, updatedAt: now };
  const db = getDb();
  if (!db) {
    const i = _mem.findIndex(x => x.id === id);
    _mem[i] = structuredClone(approved);
    return { ok: true, proposal: approved };
  }
  const { error } = await db.from('client_proposals')
    .update({ status: 'approved', approved_at: now, approved_by: approvedBy, updated_at: now })
    .eq('id', id).eq('status', 'draft');
  if (error) throw new Error(error.message);
  return { ok: true, proposal: approved };
}

/** Només per a tests. */
export function __resetProposalsForTests() { _mem.length = 0; }

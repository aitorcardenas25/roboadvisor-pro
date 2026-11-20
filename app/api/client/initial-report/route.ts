// GET → l'informe inicial del client de la sessió: l'última proposta aprovada
// (foto inicial: diagnòstic, objectius i cartera proposada) i les seves dades.
// Només llegeix dades del mateix usuari (mai d'un altre client).
import { NextResponse } from 'next/server';
import { findLeadForUser } from '@/lib/leads';
import { getProposals, proposalStats, type ClientProposal } from '@/lib/proposals';
import { recordActivity } from '@/lib/betaActivity';
import { getClientTarget } from '@/lib/clientTarget';

/** Sense els camps interns de l'assessor (qui l'ha aprovat, revisió d'idoneïtat). */
function clientView(p: ClientProposal) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { approvedBy, appliedBy, suitability, suitabilityOverride, ...rest } = p;
  return { ...rest, stats: proposalStats(p) };
}


export async function GET() {
  const u = await getClientTarget();
  if (!u) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }
  try {
    const [lead, proposals] = await Promise.all([findLeadForUser(u.id, u.email ?? null), getProposals(u.id)]);
    // Esborranys no: el client només veu el que l'assessor ha aprovat
    const approved = proposals.filter(p => p.status === 'approved');
    if (u.role === 'client') recordActivity(u.id, 'reports.view');
    return NextResponse.json({
      client:   { name: u.name ?? lead?.name ?? 'Client', email: u.email ?? '' },
      personal: (lead?.questionnaireData ?? {}) as Record<string, unknown>,
      proposal: approved[0] ? clientView(approved[0]) : null,
      versions: approved.length,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[client/initial-report]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'No s\'ha pogut carregar l\'informe' }, { status: 500 });
  }
}

// GET → l'informe inicial del client de la sessió: l'última proposta aprovada
// (foto inicial: diagnòstic, objectius i cartera proposada) i les seves dades.
// Només llegeix dades del mateix usuari (mai d'un altre client).
import { NextResponse } from 'next/server';
import { findLeadForUser } from '@/lib/leads';
import { getProposals, proposalStats, type ClientProposal } from '@/lib/proposals';
import { recordActivity } from '@/lib/betaActivity';
import { getClientTarget } from '@/lib/clientTarget';
import { getFundDrawdowns } from '@/lib/fundNavs';
import type { FundDrawdowns } from '@/lib/drawdowns';

/** Sense els camps interns de l'assessor (qui l'ha aprovat, revisió d'idoneïtat). */
function clientView(p: ClientProposal) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { approvedBy, appliedBy, suitability, suitabilityOverride, sharedBy, ...rest } = p;
  return { ...rest, stats: proposalStats(p) };
}


export async function GET(req: Request) {
  // ?summary=1 → només les versions (sense caigudes), per a l'avís de «La meva cartera»
  const summary = new URL(req.url).searchParams.get('summary') === '1';
  const u = await getClientTarget();
  if (!u) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }
  try {
    const [lead, proposals] = await Promise.all([findLeadForUser(u.id, u.email ?? null), getProposals(u.id)]);
    // El client només veu les versions aprovades que l'assessor li ha enviat
    const approved = proposals.filter(p => p.status === 'approved' && !!p.sharedAt);
    if (summary) {
      return NextResponse.json({
        versions: approved.map(p => ({ version: p.version, sharedAt: p.sharedAt, appliedAt: p.appliedAt })),
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (u.role === 'client') recordActivity(u.id, 'reports.view');
    // Caigudes històriques dels fons proposats (només valors liquidatius oficials desats)
    let drawdowns: FundDrawdowns[] = [];
    // (de tots els fons de totes les versions enviades: el client pot canviar de versió)
    const isins = [...new Set(approved.flatMap(p => p.items.map(i => i.isin)))];
    if (isins.length) {
      try { drawdowns = await getFundDrawdowns(isins); }
      catch (err) { console.error('[client/initial-report] caigudes:', err instanceof Error ? err.message : err); }
    }
    return NextResponse.json({
      client:   { name: u.name ?? lead?.name ?? 'Client', email: u.email ?? '' },
      personal: (lead?.questionnaireData ?? {}) as Record<string, unknown>,
      proposal: approved[0] ? clientView(approved[0]) : null,
      versions: approved.length,
      // Totes les versions enviades (la més nova primer): el client pot veure les anteriors
      history:  approved.map(clientView),
      drawdowns,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[client/initial-report]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'No s\'ha pogut carregar l\'informe' }, { status: 500 });
  }
}

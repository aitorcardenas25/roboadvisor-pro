// lib/portfolioAlertsServer.ts — avisos de revisió per a totes les carteres (o una), amb dades de la BD.
import { getAllClientPortfolios, type ClientPortfolio } from './clientPortfolios';
import { getProposals } from './proposals';
import { computeDrift, reviewStatus, type DriftResult, type ReviewStatus } from './portfolioAlerts';

export interface PortfolioAlert {
  clientId:        string;
  clientName:      string;
  portfolioId:     string;
  targetVersion:   number | null;   // versió de la proposta que fa d'objectiu
  drift:           DriftResult | null;
  review:          ReviewStatus;
}

/**
 * Proposta que fa d'objectiu d'una cartera: l'última versió que s'hi va passar
 * (per data d'aplicació); si no n'hi ha, l'última aprovada.
 */
export async function targetProposal(p: Pick<ClientPortfolio, 'id' | 'clientId'>) {
  const approved = (await getProposals(p.clientId)).filter(x => x.status === 'approved');
  const applied = approved.filter(x => x.appliedPortfolioId === p.id && x.appliedAt)
    .sort((a, b) => (b.appliedAt ?? '').localeCompare(a.appliedAt ?? '') || b.version - a.version);
  return { target: applied[0] ?? approved[0] ?? null, lastApprovedAt: approved[0]?.approvedAt };
}

export async function alertFor(p: ClientPortfolio, today?: string): Promise<PortfolioAlert> {
  const { target, lastApprovedAt } = await targetProposal(p);
  const held = p.holdings.filter(h => h.quantity > 0);
  return {
    clientId: p.clientId, clientName: p.clientName, portfolioId: p.id,
    targetVersion: target?.version ?? null,
    drift: target && held.length ? computeDrift(held, target.items) : null,
    review: reviewStatus({ nextFollowup: p.nextFollowup, lastApprovedAt }, today),
  };
}

export async function getPortfolioAlerts(clientId?: string): Promise<PortfolioAlert[]> {
  const all = (await getAllClientPortfolios()).filter(p => !clientId || p.clientId === clientId);
  return Promise.all(all.filter(p => p.holdings.some(h => h.quantity > 0)).map(p => alertFor(p)));
}

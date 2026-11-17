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

export async function alertFor(p: ClientPortfolio, today?: string): Promise<PortfolioAlert> {
  const approved = (await getProposals(p.clientId)).filter(x => x.status === 'approved');
  // Objectiu: la versió que es va passar a aquesta cartera; si no, l'última aprovada.
  const target = approved.find(x => x.appliedPortfolioId === p.id) ?? approved[0] ?? null;
  const held = p.holdings.filter(h => h.quantity > 0);
  return {
    clientId: p.clientId, clientName: p.clientName, portfolioId: p.id,
    targetVersion: target?.version ?? null,
    drift: target && held.length ? computeDrift(held, target.items) : null,
    review: reviewStatus({ nextFollowup: p.nextFollowup, lastApprovedAt: approved[0]?.approvedAt }, today),
  };
}

export async function getPortfolioAlerts(clientId?: string): Promise<PortfolioAlert[]> {
  const all = (await getAllClientPortfolios()).filter(p => !clientId || p.clientId === clientId);
  return Promise.all(all.filter(p => p.holdings.some(h => h.quantity > 0)).map(p => alertFor(p)));
}

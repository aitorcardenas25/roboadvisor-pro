// lib/proposalApply.ts — passa una proposta APROVADA a la cartera REAL del client.
// Compra cada fons al seu valor liquidatiu oficial (fund_navs) del dia triat.
// Primera versió: només per a carteres buides (primera inversió). Una
// reestructuració d'una cartera amb posicions es continua fent a mà.

import { getProposal, markApplied } from './proposals';
import { getPortfolioByClientId, createClientPortfolio, addHolding, addTransaction } from './clientPortfolios';
import { getNavs } from './fundNavs';
import { planApplication, type ApplyLine } from './portfolioValuation';
import type { NavPoint } from './navMath';

export type ApplyResult =
  | { ok: true; portfolioId: string; lines: ApplyLine[] }
  | { ok: false; status: number; error: string; problems?: string[] };

export async function applyProposal(input: {
  clientId: string; clientName: string; proposalId: string; date: string; amount: number; broker: string; by: string;
}): Promise<ApplyResult> {
  const p = await getProposal(input.clientId, input.proposalId);
  if (!p) return { ok: false, status: 404, error: 'Proposta no trobada' };
  if (p.status !== 'approved') return { ok: false, status: 422, error: 'Només es pot passar a la cartera una versió aprovada' };
  if (p.appliedAt) return { ok: false, status: 409, error: `Aquesta versió ja es va passar a la cartera el ${p.appliedAt.slice(0, 10)}` };

  const existing = await getPortfolioByClientId(input.clientId);
  if (existing?.holdings.length) {
    return { ok: false, status: 409, error: 'La cartera activa ja té posicions. De moment això només funciona per a la primera inversió; una reestructuració s\'ha de fer a mà a "Cartera activa".' };
  }

  const navs: NavPoint[] = (await Promise.all(p.items.filter(i => i.weight > 0).map(i => getNavs(i.isin.toUpperCase())))).flat();
  const plan = planApplication(p.items, input.amount, input.date, navs);
  if (plan.problems.length) return { ok: false, status: 422, error: 'No es pot passar a la cartera', problems: plan.problems };

  const portfolio = existing ?? await createClientPortfolio({
    clientId: input.clientId, clientName: input.clientName, name: `Cartera de ${input.clientName}`,
    description: `Creada a partir de la proposta v${p.version}`, recommendations: '',
  });
  // Es reserva la versió abans de comprar: dos clics alhora no fan dues compres.
  if (!await markApplied(input.clientId, p.id, input.by, portfolio.id)) {
    return { ok: false, status: 409, error: 'Aquesta versió ja s\'està passant a la cartera o ha canviat. Torna a carregar.' };
  }

  const latest = new Map<string, NavPoint>();
  for (const n of navs) { const k = n.isin.toUpperCase(); if (!latest.has(k) || latest.get(k)!.date < n.date) latest.set(k, n); }

  for (const l of plan.lines) {
    const last = latest.get(l.isin)!;
    const h = await addHolding(portfolio.id, {
      assetIsin: l.isin, assetName: l.name, assetCategory: l.category, broker: input.broker,
      quantity: l.quantity, avgEntryPrice: l.nav, currentPrice: last.nav, priceLastUpdated: last.date,
      priceSource: 'manual', currency: l.currency, notes: `Proposta v${p.version}: ${l.weight} %, VL del ${l.navDate}`,
    });
    await addTransaction(portfolio.id, {
      holdingId: h.id, operationType: 'buy', ticker: l.isin, assetName: l.name, date: input.date,
      quantity: l.quantity, priceEur: l.nav, totalEur: l.amount, commission: 0, broker: input.broker,
      notes: `Proposta v${p.version}`,
    });
  }
  return { ok: true, portfolioId: portfolio.id, lines: plan.lines };
}

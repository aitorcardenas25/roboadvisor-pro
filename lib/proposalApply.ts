// lib/proposalApply.ts — passa una proposta APROVADA a la cartera REAL del client.
// Tot es fa al valor liquidatiu oficial (fund_navs) del dia triat.
//  · Cartera buida → primera inversió: es compra cada fons pel seu pes.
//  · Cartera amb posicions → reestructuració: es valora la cartera, s'hi suma
//    l'aportació nova i es venen/compren participacions fins als pesos nous.
// Amb `dryRun` només es calculen les operacions (per revisar-les abans).

import { getProposal, markApplied, unmarkApplied } from './proposals';
import {
  getPortfolioByClientId, createClientPortfolio, deleteClientPortfolio,
  addHolding, addTransaction, removeHolding, removeTransaction, updateHolding,
  type ClientHolding, type ClientPortfolio,
} from './clientPortfolios';
import { getNavs } from './fundNavs';
import { planApplication, planRebalance, type ApplyLine, type RebalanceLine } from './portfolioValuation';
import type { NavPoint } from './navMath';

export type ApplyMode = 'first' | 'rebalance';

export type ApplyResult =
  | { ok: true; mode: ApplyMode; dryRun: boolean; portfolioId?: string; lines: RebalanceLine[]; currentValue: number; newValue: number }
  | { ok: false; status: number; error: string; problems?: string[] };

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Primera inversió expressada com a operacions de compra. */
const asBuys = (lines: ApplyLine[]): RebalanceLine[] => lines.map(l => ({
  isin: l.isin, name: l.name, category: l.category, weight: l.weight, side: 'buy', quantity: l.quantity,
  amount: l.amount, nav: l.nav, navDate: l.navDate, currency: l.currency, currentQty: 0, targetQty: l.quantity,
}));

/**
 * Una reestructuració automàtica només és fiable si les operacions registrades
 * de cada posició quadren amb les participacions (si no, l'evolució no quadraria).
 */
function inconsistentHoldings(p: ClientPortfolio): string[] {
  return p.holdings.filter(h => h.quantity > 0).flatMap(h => {
    const qty = p.transactions.filter(t => t.holdingId === h.id && (t.operationType === 'buy' || t.operationType === 'sell'))
      .reduce((s, t) => s + (t.operationType === 'buy' ? t.quantity : -t.quantity), 0);
    return Math.abs(qty - h.quantity) > 1e-6 * Math.max(1, h.quantity)
      ? [`${h.assetName}: té ${h.quantity} participacions però les compres i vendes registrades sumen ${r6(qty)}. Registra les operacions que falten a "Compres" abans de reestructurar.`]
      : [];
  });
}

export async function applyProposal(input: {
  clientId: string; clientName: string; proposalId: string; date: string; amount: number; broker: string; by: string; dryRun?: boolean;
}): Promise<ApplyResult> {
  const p = await getProposal(input.clientId, input.proposalId);
  if (!p) return { ok: false, status: 404, error: 'Proposta no trobada' };
  if (p.status !== 'approved') return { ok: false, status: 422, error: 'Només es pot passar a la cartera una versió aprovada' };
  if (p.appliedAt) return { ok: false, status: 409, error: `Aquesta versió ja es va passar a la cartera el ${p.appliedAt.slice(0, 10)}` };

  const existing = await getPortfolioByClientId(input.clientId);
  const open = existing?.holdings.filter(h => h.quantity > 0) ?? [];
  const mode: ApplyMode = open.length ? 'rebalance' : 'first';

  const isins = new Set([...p.items.filter(i => i.weight > 0).map(i => i.isin.toUpperCase()), ...open.map(h => h.assetIsin.toUpperCase())]);
  const navs: NavPoint[] = (await Promise.all([...isins].map(i => getNavs(i)))).flat();

  let lines: RebalanceLine[], currentValue = 0, newValue: number;
  if (mode === 'first') {
    const plan = planApplication(p.items, input.amount, input.date, navs);
    if (plan.problems.length) return { ok: false, status: 422, error: 'No es pot passar a la cartera', problems: plan.problems };
    lines = asBuys(plan.lines);
    newValue = r2(lines.reduce((s, l) => s + l.amount, 0));
  } else {
    const lastTx = existing!.transactions.map(t => t.date.slice(0, 10)).sort().at(-1);
    const problems = inconsistentHoldings(existing!);
    if (lastTx && input.date < lastTx) problems.push(`La data de la reestructuració (${input.date}) és anterior a l'última operació de la cartera (${lastTx}).`);
    if (problems.length) return { ok: false, status: 422, error: 'No es pot reestructurar automàticament', problems };
    const plan = planRebalance(p.items, open.map(h => ({ id: h.id, isin: h.assetIsin, name: h.assetName, quantity: h.quantity })), input.amount, input.date, navs);
    if (plan.problems.length) return { ok: false, status: 422, error: 'No es pot reestructurar', problems: plan.problems };
    ({ lines, currentValue, newValue } = plan);
  }
  if (input.dryRun) return { ok: true, mode, dryRun: true, portfolioId: existing?.id, lines, currentValue, newValue };

  const portfolio = existing ?? await createClientPortfolio({
    clientId: input.clientId, clientName: input.clientName, name: `Cartera de ${input.clientName}`,
    description: `Creada a partir de la proposta v${p.version}`, recommendations: '',
  });
  // Es reserva la versió abans d'operar: dos clics alhora no fan dues vegades les operacions.
  if (!await markApplied(input.clientId, p.id, input.by, portfolio.id)) {
    return { ok: false, status: 409, error: 'Aquesta versió ja s\'està passant a la cartera o ha canviat. Torna a carregar.' };
  }

  const latest = new Map<string, NavPoint>();
  for (const n of navs) { const k = n.isin.toUpperCase(); if (!latest.has(k) || latest.get(k)!.date < n.date) latest.set(k, n); }
  const label = mode === 'first' ? `Proposta v${p.version}` : `Reestructuració a la proposta v${p.version}`;

  // Supabase no permet una transacció des d'aquí: si alguna escriptura falla,
  // es desfà tot el que s'ha fet i la versió es pot tornar a passar.
  const created: { holdings: string[]; txs: string[] } = { holdings: [], txs: [] };
  const before = new Map<string, Pick<ClientHolding, 'quantity' | 'avgEntryPrice' | 'currentPrice' | 'priceLastUpdated'>>();
  try {
    for (const l of lines) {
      const last = latest.get(l.isin)!;
      const h = l.holdingId ? portfolio.holdings.find(x => x.id === l.holdingId)! : null;
      let holdingId = l.holdingId;
      if (h) {
        before.set(h.id, { quantity: h.quantity, avgEntryPrice: h.avgEntryPrice, currentPrice: h.currentPrice, priceLastUpdated: h.priceLastUpdated });
        const qty = l.side === 'buy' ? r6(h.quantity + l.quantity) : r6(h.quantity - l.quantity);
        // Preu mitjà: les compres el recalculen; les vendes no el canvien.
        const avg = l.side === 'buy' && qty > 0 ? r6((h.quantity * h.avgEntryPrice + l.amount) / qty) : h.avgEntryPrice;
        await updateHolding(h.id, portfolio.id, { quantity: Math.max(0, qty), avgEntryPrice: avg, currentPrice: last.nav, priceLastUpdated: last.date });
      } else {
        const nh = await addHolding(portfolio.id, {
          assetIsin: l.isin, assetName: l.name, assetCategory: l.category, broker: input.broker,
          quantity: l.quantity, avgEntryPrice: l.nav, currentPrice: last.nav, priceLastUpdated: last.date,
          priceSource: 'manual', currency: l.currency, notes: `${label}: ${l.weight} %, VL del ${l.navDate}`,
        });
        created.holdings.push(nh.id);
        holdingId = nh.id;
      }
      const tx = await addTransaction(portfolio.id, {
        holdingId, operationType: l.side, ticker: l.isin, assetName: l.name, date: input.date,
        quantity: l.quantity, priceEur: l.nav, totalEur: l.amount, commission: 0, broker: h?.broker || input.broker,
        notes: label,
      });
      created.txs.push(tx.id);
    }
  } catch (err) {
    console.error('[proposalApply] error escrivint les operacions, es desfà:', err instanceof Error ? err.message : err);
    try {
      for (const t of created.txs) await removeTransaction(t, portfolio.id);
      for (const h of created.holdings) await removeHolding(h, portfolio.id);
      for (const [id, prev] of before) await updateHolding(id, portfolio.id, prev);
      if (!existing) await deleteClientPortfolio(portfolio.id);
      await unmarkApplied(input.clientId, p.id);
    } catch (undoErr) {
      console.error('[proposalApply] no s\'ha pogut desfer del tot:', undoErr instanceof Error ? undoErr.message : undoErr);
      return { ok: false, status: 500, error: 'Error escrivint les operacions i no s\'ha pogut desfer del tot. Revisa "Cartera activa" abans de tornar-ho a provar.' };
    }
    return { ok: false, status: 500, error: 'Error escrivint les operacions. No s\'ha desat res; torna-ho a provar.' };
  }
  return { ok: true, mode, dryRun: false, portfolioId: portfolio.id, lines, currentValue, newValue };
}

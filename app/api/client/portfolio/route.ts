import { NextResponse } from 'next/server';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { recordActivity } from '@/lib/betaActivity';
import { loadValuation } from '@/lib/portfolioExcel';
import type { Valuation } from '@/lib/portfolioValuation';
import { daysBefore, getFundDrawdowns, getMonthEndNavsFor } from '@/lib/fundNavs';
import type { FundDrawdowns } from '@/lib/drawdowns';
import { sameMix, simulateWindows, type MixHistory, type MixWeight } from '@/lib/mixHistory';
import type { ClientPortfolio } from '@/lib/clientPortfolios';
import { getClientTarget } from '@/lib/clientTarget';
import { getProposals, type ClientProposal } from '@/lib/proposals';

interface MixResult {
  history: Record<string, MixHistory | null> | null;
  /** La proposta vigent enviada, simulada sobre els mateixos mesos (si és diferent de la cartera). */
  proposal: { version: number; sharedAt?: string; history: Record<string, MixHistory | null> } | null;
}

/**
 * Composició d'avui (pes per valor amb l'últim VL oficial) simulada a 1, 3, 5 i
 * 10 anys. Si l'assessor ha enviat una proposta amb fons o pesos diferents, també
 * la proposta, sobre exactament els mateixos mesos per poder-les comparar.
 */
async function loadMixHistory(portfolio: ClientPortfolio, proposal: ClientProposal | undefined): Promise<MixResult> {
  const open = portfolio.holdings.filter(h => h.quantity > 0 && h.assetIsin);
  if (!open.length) return { history: null, proposal: null };
  const isins = [...new Set(open.map(h => h.assetIsin!.toUpperCase()))];
  const propW: MixWeight[] = (proposal?.items ?? []).filter(i => i.weight > 0).map(i => ({ isin: i.isin.toUpperCase(), name: i.name || i.isin, weight: i.weight }));
  const all = [...new Set([...isins, ...propW.map(w => w.isin)])];
  // La simulació arriba a 10 anys enrere: no cal llegir tot l'històric diari
  const since = daysBefore(new Date().toISOString().slice(0, 10), 10 * 366 + 60);
  const navs = await getMonthEndNavsFor(all, since);
  const lastNav = (isin: string) => navs.filter(n => n.isin === isin).at(-1)?.nav ?? 0;
  const values = isins.map(isin => ({
    isin,
    name: open.find(h => h.assetIsin!.toUpperCase() === isin)!.assetName,
    value: open.filter(h => h.assetIsin!.toUpperCase() === isin).reduce((s, h) => s + h.quantity * lastNav(isin), 0),
  }));
  const total = values.reduce((s, v) => s + v.value, 0);
  if (total <= 0) return { history: null, proposal: null };
  const weights = values.map(v => ({ isin: v.isin, name: v.name, weight: v.value / total * 100 }));
  const compare = proposal && propW.length && !sameMix(weights, propW);
  if (!compare) return { history: simulateWindows(weights, navs), proposal: null };
  return {
    history: simulateWindows(weights, navs, propW),
    proposal: { version: proposal.version, sharedAt: proposal.sharedAt, history: simulateWindows(propW, navs, weights) },
  };
}

export async function GET() {
  const t = await getClientTarget();
  const userId = t?.id;
  const role   = t?.role;

  if (!userId) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }

  if (role === 'client') recordActivity(userId, 'portfolio.view');
  const portfolio = await getPortfolioByClientId(userId);
  // Evolució calculada amb els valors liquidatius oficials (fund_navs). Si falla
  // o falten preus, la pàgina fa servir els snapshots de l'assessor.
  let valuation: Valuation | null = null;
  if (portfolio?.holdings.length) {
    try {
      valuation = await loadValuation(portfolio);
    } catch (err) {
      console.error('[client/portfolio] valoració amb preus oficials:', err instanceof Error ? err.message : err);
    }
  }
  // Última proposta enviada al client (per comparar-la i pel perfil)
  let proposal: ClientProposal | undefined;
  try { proposal = (await getProposals(userId)).find(p => p.status === 'approved' && !!p.sharedAt); }
  catch { proposal = undefined; }
  // Simulació: la composició d'avui (i la de la proposta) als últims 1, 3, 5 i 10 anys
  let history: Record<string, MixHistory | null> | null = null;
  let proposalHistory: MixResult['proposal'] = null;
  if (portfolio?.holdings.length) {
    try {
      const r = await loadMixHistory(portfolio, proposal);
      history = r.history;
      proposalHistory = r.proposal;
    } catch (err) {
      console.error('[client/portfolio] simulació històrica:', err instanceof Error ? err.message : err);
    }
  }
  // Caigudes històriques dels fons que té ara (valors liquidatius oficials)
  let drawdowns: FundDrawdowns[] = [];
  const isins = portfolio?.holdings.filter(h => h.quantity > 0 && h.assetIsin).map(h => h.assetIsin!) ?? [];
  if (isins.length) {
    try { drawdowns = (await getFundDrawdowns(isins)).filter(d => d.monthlyPoints > 0); }
    catch (err) { console.error('[client/portfolio] caigudes:', err instanceof Error ? err.message : err); }
  }
  // Perfil de l'última proposta enviada: als conservadors la secció surt oberta
  const profile: string | null = drawdowns.length ? proposal?.profile ?? null : null;
  // Never expose other clients' data: server ensures we always query by session userId
  return NextResponse.json({ portfolio: portfolio ?? null, valuation, history, proposalHistory, drawdowns, profile });
}

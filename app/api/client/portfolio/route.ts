import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { recordActivity } from '@/lib/betaActivity';
import { loadValuation } from '@/lib/portfolioExcel';
import type { Valuation } from '@/lib/portfolioValuation';
import { getNavs } from '@/lib/fundNavs';
import { simulateMix, type MixHistory } from '@/lib/mixHistory';
import type { ClientPortfolio } from '@/lib/clientPortfolios';

/** Composició d'avui (pes per valor amb l'últim VL oficial) simulada a 1, 3 i 5 anys. */
async function loadMixHistory(portfolio: ClientPortfolio): Promise<Record<string, MixHistory | null> | null> {
  const open = portfolio.holdings.filter(h => h.quantity > 0 && h.assetIsin);
  if (!open.length) return null;
  const isins = [...new Set(open.map(h => h.assetIsin!.toUpperCase()))];
  const navs = (await Promise.all(isins.map(i => getNavs(i)))).flat();
  const lastNav = (isin: string) => navs.filter(n => n.isin === isin).at(-1)?.nav ?? 0;
  const values = isins.map(isin => ({
    isin,
    name: open.find(h => h.assetIsin!.toUpperCase() === isin)!.assetName,
    value: open.filter(h => h.assetIsin!.toUpperCase() === isin).reduce((s, h) => s + h.quantity * lastNav(isin), 0),
  }));
  const total = values.reduce((s, v) => s + v.value, 0);
  if (total <= 0) return null;
  const weights = values.map(v => ({ isin: v.isin, name: v.name, weight: v.value / total * 100 }));
  return { '1': simulateMix(weights, navs, 1), '3': simulateMix(weights, navs, 3), '5': simulateMix(weights, navs, 5) };
}

type S = { user?: { id?: string; role?: string } } | null;

export async function GET() {
  const session = await getServerSession(authOptions) as S;
  const userId  = session?.user?.id;
  const role    = session?.user?.role;

  if (!userId || (role !== 'client' && role !== 'admin')) {
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
  // Simulació: la composició d'avui als últims 1, 3 i 5 anys (preus oficials)
  let history: Record<string, MixHistory | null> | null = null;
  if (portfolio?.holdings.length) {
    try {
      history = await loadMixHistory(portfolio);
    } catch (err) {
      console.error('[client/portfolio] simulació històrica:', err instanceof Error ? err.message : err);
    }
  }
  // Never expose other clients' data: server ensures we always query by session userId
  return NextResponse.json({ portfolio: portfolio ?? null, valuation, history });
}

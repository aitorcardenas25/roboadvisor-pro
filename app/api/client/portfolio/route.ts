import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { recordActivity } from '@/lib/betaActivity';
import { loadValuation } from '@/lib/portfolioExcel';
import type { Valuation } from '@/lib/portfolioValuation';

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
  // Never expose other clients' data: server ensures we always query by session userId
  return NextResponse.json({ portfolio: portfolio ?? null, valuation });
}

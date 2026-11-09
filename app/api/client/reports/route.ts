import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { getMonthlyReportsByPortfolio } from '@/lib/monthlyReports';
import { recordActivity } from '@/lib/betaActivity';

type S = { user?: { id?: string; role?: string } } | null;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  const userId  = session?.user?.id;
  const role    = session?.user?.role;

  if (!userId || (role !== 'client' && role !== 'admin')) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  // Només l'admin pot demanar un portfolioId concret: un client sempre veu el seu.
  const portfolioId = role === 'admin' ? searchParams.get('portfolioId') : null;
  if (role === 'client') recordActivity(userId, 'reports.view');

  // Resolve portfolio — either by explicit ID (admin viewing a specific client)
  // or by session userId (client viewing their own)
  let resolvedPortfolioId = portfolioId;
  if (!resolvedPortfolioId) {
    const portfolio = await getPortfolioByClientId(userId);
    if (!portfolio) return NextResponse.json({ reports: [] });
    resolvedPortfolioId = portfolio.id;
  }

  const reports = await getMonthlyReportsByPortfolio(resolvedPortfolioId);

  return NextResponse.json({
    reports: reports.map(r => ({
      id:          r.id,
      portfolioId: r.portfolioId,
      periodStart: r.periodStart,
      periodEnd:   r.periodEnd,
      createdAt:   r.createdAt,
      sentAt:      r.sentAt,
      clientName:  r.clientName,
    })),
  });
}

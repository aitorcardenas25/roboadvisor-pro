// GET → informe fiscal (IRPF) de la cartera del client de la sessió
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { taxReportOf } from '@/lib/taxReportServer';
import { recordActivity } from '@/lib/betaActivity';

type S = { user?: { id?: string; role?: string } } | null;

export async function GET() {
  const session = await getServerSession(authOptions) as S;
  const userId = session?.user?.id;
  if (!userId || session?.user?.role !== 'client') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  recordActivity(userId, 'reports.view');
  const portfolio = await getPortfolioByClientId(userId);
  return NextResponse.json({ report: portfolio ? taxReportOf(portfolio) : null }, { headers: { 'Cache-Control': 'no-store' } });
}

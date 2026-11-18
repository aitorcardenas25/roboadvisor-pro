// GET → informe fiscal (IRPF) de la cartera del client de la sessió
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { taxReportOf } from '@/lib/taxReportServer';
import { recordActivity } from '@/lib/betaActivity';
import { CLIENT_TAX_REPORT_ENABLED } from '@/lib/featureFlags';

type S = { user?: { id?: string; role?: string } } | null;

export async function GET() {
  const session = await getServerSession(authOptions) as S;
  const userId = session?.user?.id;
  if (!userId || session?.user?.role !== 'client') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  // Amagat als clients fins que un expert revisi els càlculs fiscals.
  if (!CLIENT_TAX_REPORT_ENABLED) return NextResponse.json({ error: 'No disponible' }, { status: 404 });
  recordActivity(userId, 'reports.view');
  const portfolio = await getPortfolioByClientId(userId);
  return NextResponse.json({ report: portfolio ? taxReportOf(portfolio) : null }, { headers: { 'Cache-Control': 'no-store' } });
}

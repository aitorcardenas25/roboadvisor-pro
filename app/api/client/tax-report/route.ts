// GET → informe fiscal (IRPF) de la cartera del client de la sessió
import { NextResponse } from 'next/server';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { taxReportOf } from '@/lib/taxReportServer';
import { recordActivity } from '@/lib/betaActivity';
import { CLIENT_TAX_REPORT_ENABLED } from '@/lib/featureFlags';
import { getClientTarget } from '@/lib/clientTarget';


export async function GET() {
  const t = await getClientTarget();
  const userId = t?.id;
  if (!userId || (t.role !== 'client' && !t.preview)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  // Es pot apagar amb NEXT_PUBLIC_ENABLE_CLIENT_TAX_REPORT=false.
  if (!CLIENT_TAX_REPORT_ENABLED) return NextResponse.json({ error: 'No disponible' }, { status: 404 });
  if (t.role === 'client') recordActivity(userId, 'reports.view');
  const portfolio = await getPortfolioByClientId(userId);
  return NextResponse.json({ report: portfolio ? taxReportOf(portfolio) : null }, { headers: { 'Cache-Control': 'no-store' } });
}

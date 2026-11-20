// GET → un informe mensual complet de la cartera del client de la sessió (només el seu).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { getMonthlyReportsByPortfolio } from '@/lib/monthlyReports';
import { recordActivity } from '@/lib/betaActivity';
import { getClientTarget } from '@/lib/clientTarget';

const Id = z.string().trim().min(1).max(100);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getClientTarget();
  const userId = t?.id;
  if (!userId || (t.role !== 'client' && !t.preview)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const parsed = Id.safeParse((await params).id);
  if (!parsed.success) return NextResponse.json({ error: 'Petició no vàlida' }, { status: 400 });

  const portfolio = await getPortfolioByClientId(userId);
  const report = portfolio ? (await getMonthlyReportsByPortfolio(portfolio.id)).find(r => r.id === parsed.data && !!r.sentAt) : undefined;   // només si ja s'ha enviat
  if (!report) return NextResponse.json({ error: 'Informe no trobat' }, { status: 404 });
  if (t.role === 'client') recordActivity(userId, 'reports.view');
  return NextResponse.json({ report: report.data }, { headers: { 'Cache-Control': 'no-store' } });
}

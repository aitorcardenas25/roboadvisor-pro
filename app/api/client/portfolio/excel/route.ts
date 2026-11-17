// GET ?period=month|quarter|year → Excel de l'evolució de la cartera del client que ha iniciat sessió
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { recordActivity } from '@/lib/betaActivity';
import { buildPortfolioWorkbook, excelResponseHeaders, loadValuation } from '@/lib/portfolioExcel';

type S = { user?: { id?: string; name?: string; role?: string } } | null;
const PeriodSchema = z.enum(['month', 'quarter', 'year']).catch('month');

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  const userId  = session?.user?.id;
  const role    = session?.user?.role;
  if (!userId || (role !== 'client' && role !== 'admin')) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const period = PeriodSchema.parse(req.nextUrl.searchParams.get('period') ?? 'month');
  // Sempre la cartera de la sessió: mai la d'un altre client
  const portfolio = await getPortfolioByClientId(userId);
  if (!portfolio) return NextResponse.json({ error: 'Encara no tens cap cartera assignada' }, { status: 404 });
  if (role === 'client') recordActivity(userId, 'data.export');

  const name = session?.user?.name ?? portfolio.clientName;
  const buf = await buildPortfolioWorkbook(portfolio, name, await loadValuation(portfolio).catch(() => null), period);
  return new NextResponse(new Uint8Array(buf), { headers: excelResponseHeaders(name, period) });
}

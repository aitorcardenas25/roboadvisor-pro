// GET ?period=month|quarter|year → Excel de l'evolució de la cartera del client que ha iniciat sessió
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { recordActivity } from '@/lib/betaActivity';
import { buildPortfolioWorkbook, excelResponseHeaders, loadValuation } from '@/lib/portfolioExcel';
import { getClientTarget } from '@/lib/clientTarget';

const PeriodSchema = z.enum(['month', 'quarter', 'year']).catch('month');

export async function GET(req: NextRequest) {
  const t = await getClientTarget();
  const userId = t?.id;
  const role   = t?.role;
  if (!userId) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const period = PeriodSchema.parse(req.nextUrl.searchParams.get('period') ?? 'month');
  // Sempre la cartera de la sessió: mai la d'un altre client
  const portfolio = await getPortfolioByClientId(userId);
  if (!portfolio) return NextResponse.json({ error: 'Encara no tens cap cartera assignada' }, { status: 404 });
  if (role === 'client') recordActivity(userId, 'data.export');

  const name = t?.name ?? portfolio.clientName;
  const buf = await buildPortfolioWorkbook(portfolio, name, await loadValuation(portfolio).catch(() => null), period);
  return new NextResponse(new Uint8Array(buf), { headers: excelResponseHeaders(name, period) });
}

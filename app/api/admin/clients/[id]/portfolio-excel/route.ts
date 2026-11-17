// GET ?period=month|quarter|year → Excel de l'evolució de la cartera activa del client (admin)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { getAllUsers } from '@/lib/users';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { buildPortfolioWorkbook, excelResponseHeaders, loadValuation } from '@/lib/portfolioExcel';

type S = { user?: { role?: string } } | null;
const PeriodSchema = z.enum(['month', 'quarter', 'year']).catch('month');

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const { id } = await params;
  const user = (await getAllUsers()).find(u => u.id === id);
  if (!user) return NextResponse.json({ error: 'Client no trobat' }, { status: 404 });
  const portfolio = await getPortfolioByClientId(id);
  if (!portfolio) return NextResponse.json({ error: 'El client no té cartera activa' }, { status: 404 });

  const period = PeriodSchema.parse(req.nextUrl.searchParams.get('period') ?? 'month');
  const buf = await buildPortfolioWorkbook(portfolio, user.name, await loadValuation(portfolio).catch(() => null), period);
  return new NextResponse(new Uint8Array(buf), { headers: excelResponseHeaders(user.name, period) });
}

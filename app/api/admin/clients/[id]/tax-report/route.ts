// GET → informe fiscal (IRPF) de les vendes i traspassos de la cartera activa del client (admin)
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { taxReportOf } from '@/lib/taxReportServer';

type S = { user?: { role?: string } } | null;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const portfolio = await getPortfolioByClientId((await params).id);
  if (!portfolio) return NextResponse.json({ report: null });
  return NextResponse.json({ report: taxReportOf(portfolio) }, { headers: { 'Cache-Control': 'no-store' } });
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { refreshAllPortfoliosPrices } from '@/lib/marketDataService';

export const dynamic = 'force-dynamic';

type S = { user?: { role?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

export async function POST() {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  if (!process.env.FMP_API_KEY) {
    return NextResponse.json({
      error:   'FMP_API_KEY no configurada',
      message: 'Configura FMP_API_KEY al .env.local per actualitzar preus automàticament.',
    }, { status: 503 });
  }

  const result = await refreshAllPortfoliosPrices();
  return NextResponse.json(result);
}

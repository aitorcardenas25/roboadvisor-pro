import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';

type S = { user?: { id?: string; role?: string } } | null;

export async function GET() {
  const session = await getServerSession(authOptions) as S;
  const userId  = session?.user?.id;
  const role    = session?.user?.role;

  if (!userId || (role !== 'authorized' && role !== 'admin')) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }

  const portfolio = await getPortfolioByClientId(userId);
  // Never expose other clients' data: server ensures we always query by session userId
  return NextResponse.json({ portfolio: portfolio ?? null });
}

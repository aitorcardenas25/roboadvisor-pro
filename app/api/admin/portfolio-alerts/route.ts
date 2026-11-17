// GET [?clientId=] → desviació respecte de la proposta i revisions pendents de les carteres actives
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { getPortfolioAlerts } from '@/lib/portfolioAlertsServer';
import { DRIFT_THRESHOLD_PP } from '@/lib/portfolioAlerts';

type S = { user?: { role?: string } } | null;
const ClientId = z.string().trim().min(1).max(100).optional();

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const parsed = ClientId.safeParse(req.nextUrl.searchParams.get('clientId') ?? undefined);
  if (!parsed.success) return NextResponse.json({ error: 'Petició no vàlida' }, { status: 400 });
  return NextResponse.json({ alerts: await getPortfolioAlerts(parsed.data), threshold: DRIFT_THRESHOLD_PP });
}

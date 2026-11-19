// GET → en quin dels 3 primers passos és el client de la sessió.
// Només llegeix dades del mateix usuari (mai d'un altre client).
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { findLeadForUser } from '@/lib/leads';
import { getProposals } from '@/lib/proposals';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { onboardingStatus } from '@/lib/onboarding';

type S = { user?: { id?: string; email?: string; role?: string } } | null;

export async function GET() {
  const session = await getServerSession(authOptions) as S;
  const u = session?.user;
  if (!u?.id || (u.role !== 'client' && u.role !== 'admin')) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }
  try {
    const [lead, proposals, portfolio] = await Promise.all([
      findLeadForUser(u.id, u.email ?? null),
      getProposals(u.id),
      getPortfolioByClientId(u.id),
    ]);
    const status = onboardingStatus({
      questionnaireData: lead?.questionnaireData ?? null,
      latestProposal: proposals[0]?.status ?? null,
      holdings: portfolio?.holdings.length ?? 0,
    });
    return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[client/onboarding]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'No s\'ha pogut carregar' }, { status: 500 });
  }
}

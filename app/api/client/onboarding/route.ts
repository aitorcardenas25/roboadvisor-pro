// GET → en quin dels 3 primers passos és el client de la sessió.
// Només llegeix dades del mateix usuari (mai d'un altre client).
import { NextResponse } from 'next/server';
import { findLeadForUser } from '@/lib/leads';
import { getProposals } from '@/lib/proposals';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { onboardingStatus } from '@/lib/onboarding';
import { getClientTarget } from '@/lib/clientTarget';


export async function GET() {
  const u = await getClientTarget();
  if (!u) {
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

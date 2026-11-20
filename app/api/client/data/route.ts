// GET → descarrega totes les dades del client de la sessió en JSON
// (RGPD art. 15 dret d'accés i art. 20 portabilitat).
import { NextResponse } from 'next/server';
import { findLeadForUser } from '@/lib/leads';
import { findUserById } from '@/lib/users';
import { getPortfolioByClientId } from '@/lib/clientPortfolios';
import { getProposals } from '@/lib/proposals';
import { buildDataExport } from '@/lib/clientData';
import { logAuditEvent } from '@/lib/auditLog';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimiter';
import { recordActivity } from '@/lib/betaActivity';
import { getConsent } from '@/lib/betaConsent';
import { getClientTarget } from '@/lib/clientTarget';


export async function GET() {
  const t = await getClientTarget();
  const userId = t?.id;
  const role   = t?.role;
  if (!userId) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }
  const rl = rateLimit(`client-export:${userId}`, 5, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs);

  const [account, lead, portfolio, proposals, consent] = await Promise.all([
    findUserById(userId),
    findLeadForUser(userId, t.email),
    getPortfolioByClientId(userId),
    getProposals(userId).catch(() => []),
    getConsent(userId),
  ]);

  const payload = buildDataExport({
    account:   account ? { ...account } : null,
    profile:   lead ? { ...lead } : null,
    portfolio,
    proposals,
    consent,
  });

  if (role === 'client') recordActivity(userId, 'data.export');
  logAuditEvent('client.data_exported', { userId, userEmail: t.email ?? undefined, resource: lead?.id, metadata: t.preview ? { by: 'admin-preview' } : undefined });

  const date = payload.exportedAt.slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type':        'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="factor-otc-dades-${date}.json"`,
      'Cache-Control':       'no-store',
    },
  });
}

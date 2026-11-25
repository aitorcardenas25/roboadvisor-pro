// GET ?anon=1 → Excel amb la base de dades de clients (només admin).
// Cada exportació queda a l'audit log (qui, quan, quants clients, anonimitzat o no).
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllUsers } from '@/lib/users';
import { getAllLeads } from '@/lib/leads';
import { getAllProposals } from '@/lib/proposals';
import { getAllClientPortfolios, computeMetrics } from '@/lib/clientPortfolios';
import { loadValuation } from '@/lib/portfolioExcel';
import { consolidateWealth } from '@/lib/wealth';
import { getActivitySince, summarizeUsage } from '@/lib/betaActivity';
import { getConsents } from '@/lib/betaConsent';
import { advisorStage } from '@/lib/onboarding';
import { buildClientsWorkbook, clientsExportFilename, type ExportClientInput } from '@/lib/clientsExport';
import { logAuditEvent } from '@/lib/auditLog';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rateLimiter';

type S = { user?: { role?: string; id?: string; email?: string } } | null;
const DAY = 86_400_000;

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const rl = rateLimit(`clients-export:${ip}`, LIMITS.reportGen.maxRequests, LIMITS.reportGen.windowMs);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs) as unknown as NextResponse;

  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const anonymize = req.nextUrl.searchParams.get('anon') === '1';
  const now = new Date();

  const [users, leads, proposals, portfolios, activity, consents] = await Promise.all([
    getAllUsers(),
    getAllLeads().catch(() => []),
    getAllProposals().catch(() => []),
    getAllClientPortfolios().catch(() => []),
    getActivitySince(new Date(now.getTime() - 35 * DAY)).catch(() => []),
    getConsents().catch(() => ({} as Awaited<ReturnType<typeof getConsents>>)),
  ]);
  const clients = users.filter(u => u.role === 'client');
  const usage = summarizeUsage(activity, clients.map(u => ({ id: u.id, name: u.name, email: u.email })), {}, now, 5);
  const usageById = new Map(usage.clients.map(c => [c.id, c]));

  const inputs: ExportClientInput[] = await Promise.all(clients.map(async u => {
    const lead = leads.find(l => l.linkedUserId === u.id) ?? leads.find(l => l.email?.toLowerCase() === u.email.toLowerCase());
    const portfolio = portfolios.find(p => p.clientId === u.id) ?? null;
    const props = proposals.filter(p => p.clientId === u.id);
    let valuation = null;
    if (portfolio?.holdings.length) {
      try { valuation = await loadValuation(portfolio); }
      catch (err) { console.error('[clients-export] valoració:', err instanceof Error ? err.message : err); }
    }
    const wealth = consolidateWealth({
      holdings: portfolio?.holdings ?? [],
      netContributed: portfolio ? computeMetrics(portfolio).totalInvested : 0,
      valuation,
      questionnaire: lead?.questionnaireData ?? null,
    });
    const us = usageById.get(u.id);
    return {
      id: u.id, name: u.name, username: u.username, email: u.email, active: u.active, createdAt: u.createdAt,
      phone: lead?.phone ?? null,
      questionnaire: lead?.questionnaireData ?? null,
      stage: advisorStage({ questionnaireData: lead?.questionnaireData ?? null, proposals: props, holdings: portfolio?.holdings.length ?? 0 }),
      consentAt: consents[u.id]?.acceptedAt ?? null,
      surveyOptIn: consents[u.id]?.surveyOptIn ?? null,
      usage: { lastSeen: us?.lastSeen ?? u.lastLoginAt ?? null, daysActive30: us?.daysActive30 ?? 0, minutes30: us?.minutes.month ?? 0, logins30: us?.logins30 ?? 0 },
      wealth,
      proposals: props.map(p => ({ version: p.version, status: p.status, profile: p.profile, horizon: p.horizon })),
      holdings: (portfolio?.holdings ?? []).map(h => ({
        isin: h.assetIsin, name: h.assetName, broker: h.broker, category: h.assetCategory,
        quantity: h.quantity, price: h.currentPrice, priceDate: h.priceLastUpdated, priceSource: h.priceSource,
      })),
    };
  }));

  const buf = await buildClientsWorkbook(inputs, { anonymize, now });

  logAuditEvent('clients.exported', {
    userId: session.user?.id, userEmail: session.user?.email, ip,
    metadata: { clients: inputs.length, anonymized: anonymize },
  });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${clientsExportFilename(now, anonymize)}"`,
      'Cache-Control':       'no-store',
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  getMonthlyReportsByPortfolio, getAllMonthlyReports, markMonthlyReportSent,
  getMonthlyReportById, markMonthlyReportEmailed, periodLabel,
} from '@/lib/monthlyReports';
import { getPortfolioById } from '@/lib/clientPortfolios';
import { findUserById } from '@/lib/users';
import { sendMonthlyReportAvailable } from '@/lib/emails';
import { logAuditEvent } from '@/lib/auditLog';
import { z } from 'zod';

type S = { user?: { id?: string; email?: string; role?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const portfolioId = req.nextUrl.searchParams.get('portfolioId');
  const records = portfolioId
    ? await getMonthlyReportsByPortfolio(portfolioId)
    : await getAllMonthlyReports();

  return NextResponse.json({ reports: records });
}

const PatchSchema = z.object({ id: z.string().min(1) });

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const rep = await getMonthlyReportById(parsed.data.id);
  if (!rep) return NextResponse.json({ error: 'Informe no trobat' }, { status: 404 });
  const ok = await markMonthlyReportSent(rep.id);
  if (!ok) return NextResponse.json({ error: 'No s\'ha pogut marcar com a enviat' }, { status: 500 });

  // Avís per correu. L'informe ja és visible al portal encara que el correu falli.
  const clientId = rep.clientId ?? (await getPortfolioById(rep.portfolioId))?.clientId;
  const client   = clientId ? await findUserById(clientId) : null;
  const mail = client?.email
    ? await sendMonthlyReportAvailable(client.email, client.name, periodLabel(rep.periodStart))
    : { success: false, error: 'No s\'ha trobat el correu del client' };
  if (mail.success) await markMonthlyReportEmailed(rep.id);
  logAuditEvent('email.monthly_report', {
    userId: session?.user?.id, userEmail: session?.user?.email, resource: rep.id,
    metadata: { ok: mail.success, error: mail.error, clientId },
  });

  return NextResponse.json({ ok: true, email: { sent: mail.success, error: mail.error } });
}

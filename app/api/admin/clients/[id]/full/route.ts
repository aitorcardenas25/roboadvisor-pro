import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllUsers } from '@/lib/users';
import { getLeadByLinkedUser, getLeadByEmail } from '@/lib/leads';
import { getAllClientPortfolios, getPortfolioById } from '@/lib/clientPortfolios';
import { getReports } from '@/lib/reportRegistry';
import { getAllMonthlyReports } from '@/lib/monthlyReports';
import { getAuditLog } from '@/lib/auditLog';

type S = { user?: { role?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const { id } = await params;

  // 1. Usuari
  const users = await getAllUsers();
  const user  = users.find(u => u.id === id);
  if (!user) return NextResponse.json({ error: 'Client no trobat' }, { status: 404 });

  // 2. Lead vinculat (per userId o per email)
  const lead = await getLeadByLinkedUser(id) ?? await getLeadByEmail(user.email);

  // 3. Cartera del client
  const allPortfolios = await getAllClientPortfolios();
  const portfolioMeta = allPortfolios.find(p => p.clientId === id);
  const portfolio     = portfolioMeta ? await getPortfolioById(portfolioMeta.id) : null;

  // 4. Informes inicials (filtrats per email)
  const allReports = await getReports();
  const reports    = allReports.filter(r =>
    r.clientEmail?.toLowerCase() === user.email.toLowerCase() ||
    r.clientName?.toLowerCase()  === user.name.toLowerCase()
  );

  // 5. Informes mensuals (filtrats per cartera)
  const allMonthly = await getAllMonthlyReports();
  const monthly    = portfolio
    ? allMonthly.filter(r => r.portfolioId === portfolio.id)
    : [];

  // 6. Audit trail (últimes 50 entrades del client)
  const audit = await getAuditLog({ userId: id, limit: 50 });

  return NextResponse.json({ user, lead, portfolio, reports, monthly, audit });
}

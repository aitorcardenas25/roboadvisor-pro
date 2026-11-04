import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllLeads, updateLeadLinks } from '@/lib/leads';
import { createUser } from '@/lib/users';
import { createClientPortfolio } from '@/lib/clientPortfolios';
import { sendWelcomeEmail } from '@/lib/emails';
import { logAuditEvent } from '@/lib/auditLog';
import { z } from 'zod';

type S = { user?: { role?: string; email?: string; id?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

const Schema = z.object({
  username:      z.string().min(3).max(50),
  password:      z.string().min(6).max(100),
  name:          z.string().min(2).max(100).optional(),
  portfolioName: z.string().max(200).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const leads = await getAllLeads();
  const lead  = leads.find(l => l.id === id);
  if (!lead) return NextResponse.json({ error: 'Lead no trobat' }, { status: 404 });
  if (lead.status === 'converted') return NextResponse.json({ error: 'Lead ja convertit' }, { status: 409 });

  const clientName = parsed.data.name ?? lead.name;

  // 1. Crear usuari
  const user = await createUser({
    username:           parsed.data.username,
    password:           parsed.data.password,
    name:               clientName,
    email:              lead.email,
    role:               'client',
    active:             true,
    subscriptionPlan:   'active',
    subscriptionStatus: 'active',
  });

  // 2. Crear cartera buida vinculada
  const portfolio = await createClientPortfolio({
    clientId:        user.id,
    clientName:      clientName,
    name:            parsed.data.portfolioName ?? `Cartera de ${clientName}`,
    description:     '',
    recommendations: '',
  });

  // 3. Vincular lead → usuari + cartera
  await updateLeadLinks(id, user.id, portfolio.id);

  // 4. Email de benvinguda (fire-and-forget)
  sendWelcomeEmail(lead.email, clientName).catch(() => {});

  // 5. Audit log
  logAuditEvent('client.created', {
    userId:    session?.user?.id ?? undefined,
    userEmail: session?.user?.email ?? undefined,
    resource:  user.id,
    metadata:  { fromLead: id, portfolioId: portfolio.id },
  });

  return NextResponse.json({ ok: true, userId: user.id, portfolioId: portfolio.id }, { status: 201 });
}

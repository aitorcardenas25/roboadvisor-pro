import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  getAllUsers, createUser, updateUserRole, deactivateUser,
} from '@/lib/users';
import type { UserRole } from '@/lib/roles';
import { logAuditEvent } from '@/lib/auditLog';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rateLimiter';
import { sendBetaWelcome } from '@/lib/emails';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { passwordLinkFor } from '@/lib/passwordLinkUrl';
import { getAllLeads } from '@/lib/leads';
import { getAllProposals } from '@/lib/proposals';
import { getAllClientPortfolios } from '@/lib/clientPortfolios';
import { advisorStage } from '@/lib/onboarding';

const CreateSchema = z.object({
  username:    z.string().trim().min(3, 'Usuari massa curt').max(60).regex(/^[\w.@-]+$/, 'Usuari: només lletres, números, punt, guió i @'),
  // Opcional: si no n'hi ha, el client tria la seva amb l'enllaç d'activació (recomanat)
  password:    z.string().min(10, 'La contrasenya ha de tenir com a mínim 10 caràcters').max(200).optional(),
  name:        z.string().trim().min(1, 'Falta el nom').max(120),
  email:       z.string().trim().email('Correu no vàlid'),
  role:        z.enum(['client', 'admin']).default('client'),
  sendWelcome: z.boolean().default(false),
});

type SessionLike = { user?: { role?: string; id?: string; email?: string } } | null;

function isAdmin(session: SessionLike): boolean {
  return (session?.user as { role?: string } | undefined)?.role === 'admin';
}

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions) as SessionLike;
  if (!isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [users, leads, proposals, portfolios] = await Promise.all([
    getAllUsers(), getAllLeads().catch(() => []), getAllProposals().catch(() => []), getAllClientPortfolios().catch(() => []),
  ]);
  // Pas de l'alta de cada client: dades → proposta → informe aprovat → cartera activa
  const withStage = users.map(u => {
    if (u.role !== 'client') return u;
    const lead = leads.find(l => l.linkedUserId === u.id) ?? leads.find(l => l.email?.toLowerCase() === u.email.toLowerCase());
    const stage = advisorStage({
      questionnaireData: lead?.questionnaireData ?? null,
      proposals: proposals.filter(p => p.clientId === u.id),
      holdings: portfolios.find(p => p.clientId === u.id)?.holdings.length ?? 0,
    });
    return { ...u, stage };
  });
  return NextResponse.json({ users: withStage });
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const rl = rateLimit(`clients-post:${ip}`, LIMITS.adminApi.maxRequests, LIMITS.adminApi.windowMs);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs) as unknown as NextResponse;

  const session = await getServerSession(authOptions) as SessionLike;
  if (!isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dades no vàlides' }, { status: 400 });
  const { username, password, name, email, role, sendWelcome } = parsed.data;

  const existing = await getAllUsers();
  if (existing.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return NextResponse.json({ error: 'Aquest usuari ja existeix' }, { status: 409 });
  }

  // Sense contrasenya: se'n posa una d'aleatòria que ningú coneix fins que el client tria la seva
  const user = await createUser({
    username, password: password ?? randomBytes(32).toString('base64url'), name, email,
    role: role as UserRole,
    active: true,
    subscriptionPlan:   'free',
    subscriptionStatus: 'active',
  });

  logAuditEvent('client.created', {
    userId:    session?.user?.id,
    userEmail: session?.user?.email,
    resource:  user.id,
    metadata:  { name: user.name, email: user.email, role: user.role },
    ip,
  });

  // Enllaç perquè triï la contrasenya (si l'admin no n'ha posat cap). Mai s'envia cap contrasenya.
  const link = password ? null : await passwordLinkFor(user.id, 'activar');
  if (link) logAuditEvent('auth.password_link_created', { userId: session?.user?.id, userEmail: session?.user?.email, resource: user.id, metadata: { purpose: 'activar' }, ip });
  let welcome: { sent: boolean; error?: string } | undefined;
  if (sendWelcome) {
    const r = await sendBetaWelcome(user.email, user.name, user.username, link ?? undefined);
    welcome = { sent: r.success, error: r.error };
    logAuditEvent('client.welcome_sent', { userId: session?.user?.id, userEmail: session?.user?.email, resource: user.id, metadata: { ok: r.success, error: r.error }, ip });
  }

  return NextResponse.json({ user, welcome, link }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest) {
  const ip = getIp(req);
  const session = await getServerSession(authOptions) as SessionLike;
  if (!isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, role } = await req.json() as { id: string; role: UserRole };
  if (!id || !role) return NextResponse.json({ error: 'Falten camps' }, { status: 400 });

  const ok = await updateUserRole(id, role);
  if (!ok) return NextResponse.json({ error: 'Usuari no trobat' }, { status: 404 });

  logAuditEvent('client.role_changed', {
    userId:    session?.user?.id,
    userEmail: session?.user?.email,
    resource:  id,
    metadata:  { newRole: role },
    ip,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const ip = getIp(req);
  const session = await getServerSession(authOptions) as SessionLike;
  if (!isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const ok = await deactivateUser(id);
  if (!ok) return NextResponse.json({ error: 'Usuari no trobat' }, { status: 404 });

  logAuditEvent('client.deactivated', {
    userId:    session?.user?.id,
    userEmail: session?.user?.email,
    resource:  id,
    ip,
  });

  return NextResponse.json({ ok: true });
}

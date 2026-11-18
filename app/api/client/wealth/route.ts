// GET    → patrimoni consolidat del client de la sessió (fons + comptes + altres − deutes).
// POST   → el client afegeix un compte, dipòsit, immoble, deute...
// PUT    → l'actualitza (?id=...)
// DELETE → l'esborra (?id=...)
// Només es consulta i es modifica la fitxa de l'usuari de la sessió.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { WealthItemInputSchema } from '@/lib/wealth';
import { buildWealthForUser, addWealthItemForUser, updateWealthItemForUser, removeWealthItemForUser } from '@/lib/wealthStore';
import { getConsent } from '@/lib/betaConsent';
import { logAuditEvent } from '@/lib/auditLog';
import { recordActivity } from '@/lib/betaActivity';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimiter';

type S = { user?: { id?: string; email?: string; role?: string } } | null;
const NO_STORE = { 'Cache-Control': 'no-store' };

async function sessionUser() {
  const s = await getServerSession(authOptions) as S;
  const u = s?.user;
  if (!u?.id || (u.role !== 'client' && u.role !== 'admin')) return null;
  return { id: u.id, email: u.email ?? null, role: u.role };
}

async function guardWrite() {
  const user = await sessionUser();
  if (!user) return { error: NextResponse.json({ error: 'No autoritzat' }, { status: 401 }) };
  if (user.role === 'client' && !(await getConsent(user.id))) {
    return { error: NextResponse.json({ error: 'Cal acceptar el consentiment de la beta', code: 'consent_required' }, { status: 403 }) };
  }
  const rl = rateLimit(`client-wealth:${user.id}`, 20, 60_000);
  if (!rl.ok) return { error: rateLimitResponse(rl.resetInMs) };
  return { user };
}

async function respond(userId: string, email: string | null) {
  return NextResponse.json(await buildWealthForUser(userId, email), { headers: NO_STORE });
}

export async function GET() {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  if (user.role === 'client') recordActivity(user.id, 'portfolio.view');
  return respond(user.id, user.email);
}

export async function POST(req: NextRequest) {
  const g = await guardWrite();
  if ('error' in g) return g.error;
  const parsed = WealthItemInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dades no vàlides' }, { status: 400 });
  const r = await addWealthItemForUser(g.user.id, g.user.email, parsed.data, 'client');
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  logAuditEvent('client.wealth_updated', { userId: g.user.id, userEmail: g.user.email ?? undefined, resource: r.leadId, metadata: { by: 'client', op: 'add', kind: parsed.data.kind } });
  if (g.user.role === 'client') recordActivity(g.user.id, 'finances.update');
  return respond(g.user.id, g.user.email);
}

export async function PUT(req: NextRequest) {
  const g = await guardWrite();
  if ('error' in g) return g.error;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  const parsed = WealthItemInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dades no vàlides' }, { status: 400 });
  const r = await updateWealthItemForUser(g.user.id, g.user.email, id, parsed.data);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  logAuditEvent('client.wealth_updated', { userId: g.user.id, userEmail: g.user.email ?? undefined, resource: r.leadId, metadata: { by: 'client', op: 'update', id } });
  if (g.user.role === 'client') recordActivity(g.user.id, 'finances.update');
  return respond(g.user.id, g.user.email);
}

export async function DELETE(req: NextRequest) {
  const g = await guardWrite();
  if ('error' in g) return g.error;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  const r = await removeWealthItemForUser(g.user.id, g.user.email, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  logAuditEvent('client.wealth_updated', { userId: g.user.id, userEmail: g.user.email ?? undefined, resource: r.leadId, metadata: { by: 'client', op: 'remove', id } });
  return respond(g.user.id, g.user.email);
}

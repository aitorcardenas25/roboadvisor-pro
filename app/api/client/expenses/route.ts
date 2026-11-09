// POST   → el client registra una despesa puntual (viatge, mòbil, cotxe...).
// DELETE → l'esborra (?id=...). En tots dos casos l'estalvi i el diagnòstic es recalculen.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { OneOffInputSchema } from '@/lib/oneOffExpenses';
import { addExpenseForUser, removeExpenseForUser } from '@/lib/expenseStore';
import { getConsent } from '@/lib/betaConsent';
import { logAuditEvent } from '@/lib/auditLog';
import { recordActivity } from '@/lib/betaActivity';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimiter';

type S = { user?: { id?: string; email?: string; role?: string } } | null;

async function guard() {
  const s = await getServerSession(authOptions) as S;
  const u = s?.user;
  if (!u?.id || (u.role !== 'client' && u.role !== 'admin')) return { error: NextResponse.json({ error: 'No autoritzat' }, { status: 401 }) };
  if (u.role === 'client' && !(await getConsent(u.id))) {
    return { error: NextResponse.json({ error: 'Cal acceptar el consentiment de la beta', code: 'consent_required' }, { status: 403 }) };
  }
  const rl = rateLimit(`client-expenses:${u.id}`, 20, 60_000);
  if (!rl.ok) return { error: rateLimitResponse(rl.resetInMs) };
  return { user: { id: u.id, email: u.email ?? null, role: u.role } };
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if ('error' in g) return g.error;
  const parsed = OneOffInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dades no vàlides' }, { status: 400 });
  const r = await addExpenseForUser(g.user.id, g.user.email, parsed.data, 'client');
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  logAuditEvent('client.expense_added', { userId: g.user.id, userEmail: g.user.email ?? undefined, resource: r.leadId, metadata: { by: 'client', amount: parsed.data.amount, category: parsed.data.category } });
  if (g.user.role === 'client') recordActivity(g.user.id, 'finances.update');
  return NextResponse.json({ data: r.data, entry: r.entry, impact: r.impact });
}

export async function DELETE(req: NextRequest) {
  const g = await guard();
  if ('error' in g) return g.error;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  const r = await removeExpenseForUser(g.user.id, g.user.email, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  logAuditEvent('client.expense_removed', { userId: g.user.id, userEmail: g.user.email ?? undefined, resource: r.leadId, metadata: { by: 'client', id } });
  return NextResponse.json({ data: r.data });
}

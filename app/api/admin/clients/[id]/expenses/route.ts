// POST   → l'assessor registra una despesa puntual d'un client (p. ex. després d'un àudio).
// DELETE → l'esborra (?id=...). L'estalvi i el diagnòstic del client es recalculen.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { findUserById } from '@/lib/users';
import { OneOffInputSchema } from '@/lib/oneOffExpenses';
import { addExpenseForUser, removeExpenseForUser } from '@/lib/expenseStore';
import { logAuditEvent } from '@/lib/auditLog';

type S = { user?: { id?: string; email?: string; role?: string } } | null;
type P = { params: Promise<{ id: string }> };

async function guard(params: P['params']) {
  const s = await getServerSession(authOptions) as S;
  if (s?.user?.role !== 'admin') return { error: NextResponse.json({ error: 'No autoritzat' }, { status: 401 }) };
  const { id } = await params;
  const client = await findUserById(id);
  if (!client) return { error: NextResponse.json({ error: 'Client no trobat' }, { status: 404 }) };
  return { admin: s.user!, client };
}

export async function POST(req: NextRequest, { params }: P) {
  const g = await guard(params);
  if ('error' in g) return g.error;
  const parsed = OneOffInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dades no vàlides' }, { status: 400 });
  const r = await addExpenseForUser(g.client.id, g.client.email, parsed.data, 'admin');
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  logAuditEvent('client.expense_added', { userId: g.admin.id, userEmail: g.admin.email, resource: r.leadId, metadata: { by: 'admin', clientId: g.client.id, amount: parsed.data.amount, category: parsed.data.category } });
  return NextResponse.json({ data: r.data, entry: r.entry, impact: r.impact });
}

export async function DELETE(req: NextRequest, { params }: P) {
  const g = await guard(params);
  if ('error' in g) return g.error;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  const r = await removeExpenseForUser(g.client.id, g.client.email, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  logAuditEvent('client.expense_removed', { userId: g.admin.id, userEmail: g.admin.email, resource: r.leadId, metadata: { by: 'admin', clientId: g.client.id, id } });
  return NextResponse.json({ data: r.data });
}

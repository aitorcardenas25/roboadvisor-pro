// Patrimoni consolidat d'un client, des de la fitxa de l'admin.
// GET → vista consolidada · POST → afegir element · PUT ?id= → actualitzar · DELETE ?id= → esborrar
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { findUserById } from '@/lib/users';
import { WealthItemInputSchema } from '@/lib/wealth';
import { buildWealthForUser, addWealthItemForUser, updateWealthItemForUser, removeWealthItemForUser } from '@/lib/wealthStore';
import { logAuditEvent } from '@/lib/auditLog';

type S = { user?: { id?: string; email?: string; role?: string } } | null;
type P = { params: Promise<{ id: string }> };
const NO_STORE = { 'Cache-Control': 'no-store' };

async function guard(params: P['params']) {
  const s = await getServerSession(authOptions) as S;
  if (s?.user?.role !== 'admin') return { error: NextResponse.json({ error: 'No autoritzat' }, { status: 401 }) };
  const { id } = await params;
  const client = await findUserById(id);
  if (!client) return { error: NextResponse.json({ error: 'Client no trobat' }, { status: 404 }) };
  return { admin: s.user!, client };
}

const respond = async (id: string, email: string) =>
  NextResponse.json(await buildWealthForUser(id, email), { headers: NO_STORE });

export async function GET(_req: NextRequest, { params }: P) {
  const g = await guard(params);
  if ('error' in g) return g.error;
  return respond(g.client.id, g.client.email);
}

export async function POST(req: NextRequest, { params }: P) {
  const g = await guard(params);
  if ('error' in g) return g.error;
  const parsed = WealthItemInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dades no vàlides' }, { status: 400 });
  const r = await addWealthItemForUser(g.client.id, g.client.email, parsed.data, 'admin');
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  logAuditEvent('client.wealth_updated', { userId: g.admin.id, userEmail: g.admin.email, resource: r.leadId, metadata: { by: 'admin', clientId: g.client.id, op: 'add', kind: parsed.data.kind } });
  return respond(g.client.id, g.client.email);
}

export async function PUT(req: NextRequest, { params }: P) {
  const g = await guard(params);
  if ('error' in g) return g.error;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  const parsed = WealthItemInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dades no vàlides' }, { status: 400 });
  const r = await updateWealthItemForUser(g.client.id, g.client.email, id, parsed.data);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  logAuditEvent('client.wealth_updated', { userId: g.admin.id, userEmail: g.admin.email, resource: r.leadId, metadata: { by: 'admin', clientId: g.client.id, op: 'update', id } });
  return respond(g.client.id, g.client.email);
}

export async function DELETE(req: NextRequest, { params }: P) {
  const g = await guard(params);
  if ('error' in g) return g.error;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  const r = await removeWealthItemForUser(g.client.id, g.client.email, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  logAuditEvent('client.wealth_updated', { userId: g.admin.id, userEmail: g.admin.email, resource: r.leadId, metadata: { by: 'admin', clientId: g.client.id, op: 'remove', id } });
  return respond(g.client.id, g.client.email);
}

// POST   { clientId } → l'admin obre la "vista del client": el portal /client mostra
//                      les dades d'aquest client, en només lectura.
// DELETE              → surt de la vista del client.
// GET                 → quin client s'està mirant (per a la franja del portal).
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { findUserById } from '@/lib/users';
import { logAuditEvent } from '@/lib/auditLog';
import { PREVIEW_COOKIE, getClientTarget } from '@/lib/clientTarget';

type S = { user?: { id?: string; email?: string; role?: string } } | null;
const Body = z.object({ clientId: z.string().trim().min(1).max(100) });
const NO_STORE = { 'Cache-Control': 'no-store' };

async function admin() {
  const s = await getServerSession(authOptions) as S;
  return s?.user?.role === 'admin' ? s.user : null;
}

export async function GET() {
  const t = await getClientTarget();
  if (!t?.preview) return NextResponse.json({ preview: null }, { headers: NO_STORE });
  return NextResponse.json({ preview: { id: t.id, name: t.name } }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const a = await admin();
  if (!a) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Petició no vàlida' }, { status: 400 });
  const client = await findUserById(parsed.data.clientId);
  if (!client || client.role !== 'client') return NextResponse.json({ error: 'Client no trobat' }, { status: 404 });

  logAuditEvent('client.preview_opened', { userId: a.id, userEmail: a.email, resource: client.id });
  const res = NextResponse.json({ ok: true, url: '/client/patrimoni' });
  res.cookies.set(PREVIEW_COOKIE, client.id, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 2 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PREVIEW_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}

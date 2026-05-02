import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { updateNewsletter, changeStatus, deleteNewsletter, getNewsletter } from '@/lib/newsletter';
import type { NewsletterStatus } from '@/lib/newsletter';

function isAdmin(session: { user?: { role?: string } } | null) {
  return (session?.user as { role?: string })?.role === 'admin';
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  const { id } = await params;
  const nl = getNewsletter(id);
  if (!nl) return NextResponse.json({ error: 'No trobada.' }, { status: 404 });
  return NextResponse.json({ newsletter: nl });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  // Canvi d'estat
  if (body.status) {
    const updated = changeStatus(id, body.status as NewsletterStatus);
    if (!updated) return NextResponse.json({ error: 'Transició d\'estat no permesa.' }, { status: 422 });
    return NextResponse.json({ newsletter: updated });
  }

  // Editar contingut
  const updated = updateNewsletter(id, body);
  if (!updated) return NextResponse.json({ error: 'No es pot editar.' }, { status: 422 });
  return NextResponse.json({ newsletter: updated });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  const { id } = await params;
  const ok = deleteNewsletter(id);
  if (!ok) return NextResponse.json({ error: 'No es pot eliminar.' }, { status: 422 });
  return NextResponse.json({ success: true });
}

// POST → genera un enllaç perquè el client creï (o torni a crear) la seva
// contrasenya i, si hi ha correu configurat, li envia la benvinguda amb l'enllaç.
// Retorna l'enllaç perquè l'admin el pugui enviar per WhatsApp si el correu falla.
// Ni el correu ni l'admin veuen mai la contrasenya.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { findUserById } from '@/lib/users';
import { sendBetaWelcome } from '@/lib/emails';
import { passwordLinkFor } from '@/lib/passwordLinkUrl';
import { logAuditEvent } from '@/lib/auditLog';

type S = { user?: { id?: string; email?: string; role?: string } } | null;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const { id } = await params;
  const user = await findUserById(id);
  if (!user || !user.active) return NextResponse.json({ error: 'Client no trobat o desactivat' }, { status: 404 });
  const sendEmail = (await req.json().catch(() => ({})))?.sendEmail !== false;

  const link = await passwordLinkFor(user.id, 'activar');
  if (!link) return NextResponse.json({ error: 'No s\'ha pogut generar l\'enllaç' }, { status: 500 });
  logAuditEvent('auth.password_link_created', { userId: session.user?.id, userEmail: session.user?.email, resource: id, metadata: { purpose: 'activar' } });

  let email: { sent: boolean; error?: string } | undefined;
  if (sendEmail && user.email) {
    const r = await sendBetaWelcome(user.email, user.name, user.username, link);
    email = { sent: r.success, error: r.error };
    logAuditEvent('client.welcome_sent', {
      userId: session.user?.id, userEmail: session.user?.email, resource: id, metadata: { ok: r.success, error: r.error },
    });
  }
  return NextResponse.json({ ok: true, link, email }, { headers: { 'Cache-Control': 'no-store' } });
}

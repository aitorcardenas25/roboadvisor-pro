// POST → (re)envia el correu de benvinguda de la beta a un client.
// El correu porta l'usuari i l'enllaç d'accés, mai la contrasenya.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { findUserById } from '@/lib/users';
import { sendBetaWelcome } from '@/lib/emails';
import { logAuditEvent } from '@/lib/auditLog';

type S = { user?: { id?: string; email?: string; role?: string } } | null;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const { id } = await params;
  const user = await findUserById(id);
  if (!user || !user.email) return NextResponse.json({ error: 'Client no trobat o sense correu' }, { status: 404 });

  const r = await sendBetaWelcome(user.email, user.name, user.username);
  logAuditEvent('client.welcome_sent', {
    userId: session.user?.id, userEmail: session.user?.email, resource: id, metadata: { ok: r.success, error: r.error },
  });
  if (!r.success) return NextResponse.json({ error: r.error === 'No API key' ? 'Resend no està configurat (falta RESEND_API_KEY)' : `No s'ha pogut enviar: ${r.error}` }, { status: 502 });
  return NextResponse.json({ ok: true });
}

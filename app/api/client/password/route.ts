// PUT → el client canvia la seva contrasenya (cal la contrasenya actual).
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { findUserById, findUserByCredentials, updatePassword } from '@/lib/users';
import { logAuditEvent } from '@/lib/auditLog';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rateLimiter';

type S = { user?: { id?: string; email?: string; role?: string } } | null;

const BodySchema = z.object({
  current: z.string().min(1).max(200),
  next:    z.string().min(10, 'La contrasenya nova ha de tenir com a mínim 10 caràcters').max(200),
}).strict();

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  const userId = session?.user?.id;
  if (!userId || (session?.user?.role !== 'client' && session?.user?.role !== 'admin')) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }
  const rl = rateLimit(`client-password:${userId}`, LIMITS.authEndpoint.maxRequests, LIMITS.authEndpoint.windowMs);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs);

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dades no vàlides' }, { status: 400 });
  if (parsed.data.current === parsed.data.next) {
    return NextResponse.json({ error: 'La contrasenya nova ha de ser diferent de l\'actual' }, { status: 400 });
  }

  const account = await findUserById(userId);
  if (!account) return NextResponse.json({ error: 'Usuari no trobat' }, { status: 404 });
  const check = await findUserByCredentials(account.username, parsed.data.current);
  if (!check || check.id !== userId) return NextResponse.json({ error: 'La contrasenya actual no és correcta' }, { status: 400 });

  const ok = await updatePassword(userId, parsed.data.next);
  if (!ok) return NextResponse.json({ error: 'No s\'ha pogut canviar' }, { status: 500 });
  logAuditEvent('client.password_changed', { userId, userEmail: account.email, resource: userId });
  return NextResponse.json({ ok: true });
}

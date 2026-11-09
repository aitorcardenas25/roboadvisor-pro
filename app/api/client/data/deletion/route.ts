// POST → el client demana esborrar les seves dades (RGPD art. 17).
// No s'esborra automàticament: l'assessor rep l'avís, comprova si alguna llei
// obliga a conservar-ne una part i respon en el termini d'1 mes (art. 12.3).
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { findUserById } from '@/lib/users';
import { logAuditEvent } from '@/lib/auditLog';
import { sendDeletionRequestToAdmin } from '@/lib/emails';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimiter';

type S = { user?: { id?: string; email?: string; name?: string; role?: string } } | null;

const BodySchema = z.object({ reason: z.string().trim().max(500).optional() }).strict();

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  const userId = session?.user?.id;
  const role   = session?.user?.role;
  if (!userId || (role !== 'client' && role !== 'admin')) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }
  const rl = rateLimit(`client-deletion:${userId}`, 3, 60 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Dades no vàlides' }, { status: 400 });

  const account = await findUserById(userId);
  const email = account?.email ?? session?.user?.email ?? '';
  const name  = account?.name ?? session?.user?.name ?? email;

  logAuditEvent('client.deletion_requested', {
    userId, userEmail: email || undefined, resource: userId,
    metadata: { reason: parsed.data.reason ?? null },
  });
  const mail = await sendDeletionRequestToAdmin({ userId, email, name, reason: parsed.data.reason });

  return NextResponse.json({ ok: true, notified: mail.success, requestedAt: new Date().toISOString() });
}

// POST { login } → "He oblidat la contrasenya": envia un enllaç (1 hora) al correu del compte.
// Sempre respon igual, existeixi o no el compte, per no revelar qui és client.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { findActiveUserByLogin } from '@/lib/users';
import { passwordLinkFor } from '@/lib/passwordLinkUrl';
import { sendPasswordReset } from '@/lib/emails';
import { logAuditEvent } from '@/lib/auditLog';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimiter';

const Body = z.object({ login: z.string().trim().min(3).max(200) }).strict();
const SAME = { ok: true, message: 'Si hi ha un compte amb aquestes dades, t\'hem enviat un correu amb un enllaç per canviar la contrasenya. Mira també el correu brossa.' };

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = rateLimit(`pwreset-ip:${ip}`, 5, 15 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Escriu el teu usuari o correu' }, { status: 400 });

  const login = parsed.data.login.toLowerCase();
  const perAccount = rateLimit(`pwreset-login:${login}`, 3, 60 * 60_000);
  if (!perAccount.ok) return NextResponse.json(SAME);

  const user = await findActiveUserByLogin(login);
  if (user?.email) {
    const link = await passwordLinkFor(user.id, 'recuperar');
    const r = link ? await sendPasswordReset(user.email, user.name, link) : { success: false, error: 'sense enllaç' };
    logAuditEvent('auth.password_reset_requested', { userId: user.id, userEmail: user.email, resource: user.id, metadata: { emailed: r.success, error: r.error }, ip });
  }
  return NextResponse.json(SAME);
}

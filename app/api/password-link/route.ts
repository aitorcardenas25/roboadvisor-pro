// Enllaç per crear o canviar la contrasenya (públic: el client encara no ha entrat).
// GET  ?t=...            → si l'enllaç és vàlid, per a quin usuari i fins quan
// POST { t, password }   → desa la contrasenya nova; l'enllaç deixa de valer
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { findUserById, getPasswordStamp, updatePassword } from '@/lib/users';
import { verifyPasswordToken, passwordProblem } from '@/lib/passwordLink';
import { logAuditEvent } from '@/lib/auditLog';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimiter';

const NO_STORE = { 'Cache-Control': 'no-store' };
const ip = (req: NextRequest) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
const REASON = {
  invalid: 'Aquest enllaç no és vàlid. Demana\'n un de nou.',
  expired: 'Aquest enllaç ha caducat. Demana\'n un de nou.',
  used:    'Aquest enllaç ja s\'ha fet servir. Si no recordes la contrasenya, demana\'n un de nou.',
} as const;

export async function GET(req: NextRequest) {
  const rl = rateLimit(`pwlink-get:${ip(req)}`, 30, 15 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs);
  const t = req.nextUrl.searchParams.get('t') ?? '';
  const check = await verifyPasswordToken(t, getPasswordStamp);
  if (!check.ok) return NextResponse.json({ ok: false, error: REASON[check.reason] }, { status: 400, headers: NO_STORE });
  const user = await findUserById(check.userId);
  if (!user) return NextResponse.json({ ok: false, error: REASON.invalid }, { status: 400, headers: NO_STORE });
  return NextResponse.json({ ok: true, purpose: check.purpose, username: user.username, name: user.name, expiresAt: check.expiresAt }, { headers: NO_STORE });
}

const Body = z.object({ t: z.string().min(10).max(2000), password: z.string().min(1).max(200) }).strict();

export async function POST(req: NextRequest) {
  const rl = rateLimit(`pwlink-post:${ip(req)}`, 10, 15 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dades no vàlides' }, { status: 400 });

  const check = await verifyPasswordToken(parsed.data.t, getPasswordStamp);
  if (!check.ok) return NextResponse.json({ error: REASON[check.reason] }, { status: 400 });
  const user = await findUserById(check.userId);
  if (!user) return NextResponse.json({ error: REASON.invalid }, { status: 400 });
  const problem = passwordProblem(parsed.data.password, user.username);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (!(await updatePassword(user.id, parsed.data.password))) {
    return NextResponse.json({ error: 'No s\'ha pogut desar. Torna-ho a provar.' }, { status: 500 });
  }
  logAuditEvent('auth.password_set', { userId: user.id, userEmail: user.email, resource: user.id, metadata: { via: check.purpose }, ip: ip(req) });
  return NextResponse.json({ ok: true, username: user.username });
}

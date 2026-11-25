// Verificació en dos passos de l'administrador.
// GET                              → { enabled, bypass }
// POST { action:'start' }          → secret nou + codi QR (encara no s'activa)
// POST { action:'confirm', secret, code } → l'activa si el codi és correcte
// POST { action:'disable', code }  → la desactiva (cal un codi vàlid)
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import QRCode from 'qrcode';
import { authOptions } from '@/lib/authOptions';
import { findUserById, getTotpSecret, setTotpSecret } from '@/lib/users';
import { newTotpSecret, otpauthUrl, verifyTotp, encryptSecret, decryptSecret, consumeStep } from '@/lib/totp';
import { logAuditEvent } from '@/lib/auditLog';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimiter';

type S = { user?: { id?: string; email?: string; role?: string } } | null;
const NO_STORE = { 'Cache-Control': 'no-store' };

async function admin() {
  const s = await getServerSession(authOptions) as S;
  return s?.user?.role === 'admin' && s.user.id ? s.user as { id: string; email?: string } : null;
}

export async function GET() {
  const a = await admin();
  if (!a) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  return NextResponse.json({ enabled: !!(await getTotpSecret(a.id)), bypass: process.env.ADMIN_2FA_DISABLE === 'true' }, { headers: NO_STORE });
}

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }),
  z.object({ action: z.literal('confirm'), secret: z.string().regex(/^[A-Z2-7]{32}$/), code: z.string().max(10) }),
  z.object({ action: z.literal('disable'), code: z.string().max(10) }),
]);

export async function POST(req: Request) {
  const a = await admin();
  if (!a) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const rl = rateLimit(`2fa:${a.id}`, 10, 15 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dades no vàlides' }, { status: 400 });
  const body = parsed.data;

  if (body.action === 'start') {
    const user = await findUserById(a.id);
    const secret = newTotpSecret();
    const url = otpauthUrl(secret, user?.username ?? 'admin');
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
    return NextResponse.json({ secret, qr }, { headers: NO_STORE });
  }

  if (body.action === 'confirm') {
    const step = verifyTotp(body.secret, body.code);
    if (step === null) return NextResponse.json({ error: 'El codi no és correcte. Comprova que l\'hora del mòbil és automàtica i torna-ho a provar.' }, { status: 400 });
    consumeStep(a.id, step);
    if (!(await setTotpSecret(a.id, encryptSecret(body.secret)))) return NextResponse.json({ error: 'No s\'ha pogut desar' }, { status: 500 });
    logAuditEvent('auth.2fa_enabled', { userId: a.id, userEmail: a.email, resource: a.id });
    return NextResponse.json({ ok: true, enabled: true });
  }

  const stored = await getTotpSecret(a.id);
  const secret = stored ? decryptSecret(stored) : null;
  if (!secret) return NextResponse.json({ ok: true, enabled: false });
  const step = verifyTotp(secret, body.code);
  if (step === null || !consumeStep(a.id, step)) return NextResponse.json({ error: 'El codi no és correcte' }, { status: 400 });
  if (!(await setTotpSecret(a.id, null))) return NextResponse.json({ error: 'No s\'ha pogut desar' }, { status: 500 });
  logAuditEvent('auth.2fa_disabled', { userId: a.id, userEmail: a.email, resource: a.id });
  return NextResponse.json({ ok: true, enabled: false });
}

// GET  → text del consentiment de la beta i si el client de la sessió ja l'ha acceptat.
// POST → registra l'acceptació (data, versió del text, opció d'enquesta, IP).
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { consentText, getConsent, saveConsent, CONSENT_VERSION } from '@/lib/betaConsent';
import { logAuditEvent } from '@/lib/auditLog';

type S = { user?: { id?: string; email?: string; role?: string } } | null;

const BodySchema = z.object({
  version:     z.literal(CONSENT_VERSION),
  accepted:    z.literal(true),
  surveyOptIn: z.boolean().default(false),
}).strict();

async function sessionUser() {
  const s = await getServerSession(authOptions) as S;
  const u = s?.user;
  if (!u?.id || (u.role !== 'client' && u.role !== 'admin')) return null;
  return { id: u.id, email: u.email ?? undefined, role: u.role };
}

export async function GET() {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  // L'admin no ha d'acceptar res: entra a les pàgines de client per revisar-les.
  const consent = user.role === 'admin' ? { acceptedAt: 'admin' } : await getConsent(user.id);
  return NextResponse.json({ required: !consent, consent, text: consentText() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Cal marcar la casella d\'acceptació (o el text ha canviat: recarrega la pàgina).' }, { status: 400 });
  }
  const acceptedAt = new Date().toISOString();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ok = await saveConsent({ userId: user.id, version: CONSENT_VERSION, acceptedAt, surveyOptIn: parsed.data.surveyOptIn, ip });
  if (!ok) return NextResponse.json({ error: 'No s\'ha pogut desar' }, { status: 500 });
  logAuditEvent('client.consent_accepted', {
    userId: user.id, userEmail: user.email, resource: user.id,
    metadata: { version: CONSENT_VERSION, surveyOptIn: parsed.data.surveyOptIn }, ip: ip ?? undefined,
  });
  return NextResponse.json({ ok: true, acceptedAt });
}

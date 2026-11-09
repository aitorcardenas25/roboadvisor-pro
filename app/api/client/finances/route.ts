// GET → dades de pressupost i objectius del client que ha iniciat sessió.
// PUT → el client omple o corregeix el pressupost i els objectius des del portal (sense Excel).
// Només es consulta i es modifica la fitxa de l'usuari de la sessió: mai la d'un altre client.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { findLeadForUser, createLead, saveLeadQuestionnaire } from '@/lib/leads';
import { findUserById } from '@/lib/users';
import { pickFinanceFields } from '@/lib/budget';
import { FinanceUpdateSchema, applyFinanceUpdate } from '@/lib/clientData';
import { logAuditEvent } from '@/lib/auditLog';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimiter';

type S = { user?: { id?: string; email?: string; name?: string; role?: string } } | null;

async function sessionUser() {
  const session = await getServerSession(authOptions) as S;
  const u = session?.user;
  if (!u?.id || (u.role !== 'client' && u.role !== 'admin')) return null;
  return { id: u.id, email: u.email ?? null, name: u.name ?? null };
}

export async function GET() {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const lead = await findLeadForUser(user.id, user.email);
  return NextResponse.json({ data: pickFinanceFields(lead?.questionnaireData) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: NextRequest) {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const rl = rateLimit(`client-finances:${user.id}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs);

  const body = await req.json().catch(() => null);
  const parsed = FinanceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dades no vàlides', issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) }, { status: 400 });
  }

  let lead = await findLeadForUser(user.id, user.email);
  if (!lead) {
    // Client donat d'alta directament per l'assessor, sense fitxa: se'n crea una.
    const account = await findUserById(user.id);
    const email = account?.email ?? user.email;
    if (!email) return NextResponse.json({ error: 'El compte no té correu electrònic' }, { status: 400 });
    lead = await createLead({ name: account?.name ?? user.name ?? email, email, interest: 'finances', source: 'client-portal' });
  }

  const next = applyFinanceUpdate(lead.questionnaireData, parsed.data);
  const ok = await saveLeadQuestionnaire(lead.id, next);
  if (!ok) return NextResponse.json({ error: 'No s\'han pogut desar les dades' }, { status: 500 });

  logAuditEvent('client.finances_updated', {
    userId: user.id, userEmail: user.email ?? undefined, resource: lead.id,
    metadata: { fields: Object.keys(parsed.data), goals: parsed.data.goals?.length },
  });
  return NextResponse.json({ data: pickFinanceFields(next) }, { headers: { 'Cache-Control': 'no-store' } });
}

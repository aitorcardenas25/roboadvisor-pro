// PUT → l'assessor entra o corregeix a mà el pressupost i els objectius d'un client
// (el mateix formulari que "Les meves finances" del portal, sense Excel).
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { findUserById } from '@/lib/users';
import { findLeadForUser, createLead, saveLeadQuestionnaire } from '@/lib/leads';
import { pickFinanceFields } from '@/lib/budget';
import { FinanceUpdateSchema, applyFinanceUpdate } from '@/lib/clientData';
import { logAuditEvent } from '@/lib/auditLog';

type S = { user?: { id?: string; email?: string; role?: string } } | null;
type P = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: P) {
  const s = await getServerSession(authOptions) as S;
  if (s?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const client = await findUserById((await params).id);
  if (!client) return NextResponse.json({ error: 'Client no trobat' }, { status: 404 });

  const parsed = FinanceUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dades no vàlides', issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) }, { status: 400 });
  }

  let lead = await findLeadForUser(client.id, client.email);
  if (!lead) lead = await createLead({ name: client.name, email: client.email, interest: 'finances', source: 'admin' });
  const next = applyFinanceUpdate(lead.questionnaireData, parsed.data);
  if (!(await saveLeadQuestionnaire(lead.id, next))) return NextResponse.json({ error: 'No s\'han pogut desar les dades' }, { status: 500 });

  logAuditEvent('client.finances_updated', {
    userId: s.user?.id, userEmail: s.user?.email, resource: lead.id,
    metadata: { by: 'admin', clientId: client.id, fields: Object.keys(parsed.data), goals: parsed.data.goals?.length },
  });
  return NextResponse.json({ data: pickFinanceFields(next) }, { headers: { 'Cache-Control': 'no-store' } });
}

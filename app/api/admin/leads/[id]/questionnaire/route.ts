import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { saveLeadQuestionnaire, getAllLeads } from '@/lib/leads';
import { sendQuestionnaireReceivedToAdmin } from '@/lib/emails';
import { z } from 'zod';

type S = { user?: { role?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

const Schema = z.object({
  questionnaireData: z.record(z.string(), z.unknown()),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const ok = await saveLeadQuestionnaire(id, parsed.data.questionnaireData);
  if (!ok) return NextResponse.json({ error: 'Lead no trobat' }, { status: 404 });

  // Notificar admin per email (fire-and-forget)
  const leads = await getAllLeads();
  const lead  = leads.find(l => l.id === id);
  if (lead) {
    sendQuestionnaireReceivedToAdmin({
      name:    lead.name,
      email:   lead.email,
      profile: lead.profile,
      leadId:  id,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

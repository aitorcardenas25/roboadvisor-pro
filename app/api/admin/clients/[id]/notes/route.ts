// PUT { notes } → notes internes de l'assessor sobre un client (no les veu el client).
// Es poden escriure des del primer dia, encara que el client no tingui cartera.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { findUserById } from '@/lib/users';
import { findLeadForUser, createLead, updateLeadNotes } from '@/lib/leads';

type S = { user?: { role?: string } } | null;
type P = { params: Promise<{ id: string }> };
const Body = z.object({ notes: z.string().max(10_000) });

export async function PUT(req: NextRequest, { params }: P) {
  const s = await getServerSession(authOptions) as S;
  if (s?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const client = await findUserById((await params).id);
  if (!client) return NextResponse.json({ error: 'Client no trobat' }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Text massa llarg' }, { status: 400 });

  let lead = await findLeadForUser(client.id, client.email);
  if (!lead) lead = await createLead({ name: client.name, email: client.email, interest: 'finances', source: 'admin' });
  if (!(await updateLeadNotes(lead.id, parsed.data.notes))) return NextResponse.json({ error: 'No s\'han pogut desar' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

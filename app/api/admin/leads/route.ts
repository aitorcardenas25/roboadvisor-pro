import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllLeads, updateLeadStatus, updateLeadNotes } from '@/lib/leads';
import type { Lead } from '@/lib/leads';

type S = { user?: { role?: string } } | null;

function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  return NextResponse.json({ leads: await getAllLeads() });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const body = await req.json() as { id: string; status?: Lead['status']; notes?: string };
  if (!body.id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  if (body.notes !== undefined) {
    const ok = await updateLeadNotes(body.id, body.notes);
    if (!ok) return NextResponse.json({ error: 'Lead no trobat' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (!body.status) return NextResponse.json({ error: 'Falten camps' }, { status: 400 });
  const ok = await updateLeadStatus(body.id, body.status);
  if (!ok) return NextResponse.json({ error: 'Lead no trobat' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

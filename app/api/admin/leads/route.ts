import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllLeads, updateLeadStatus } from '@/lib/leads';
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

  const { id, status } = await req.json() as { id: string; status: Lead['status'] };
  if (!id || !status) return NextResponse.json({ error: 'Falten camps' }, { status: 400 });

  const ok = await updateLeadStatus(id, status);
  if (!ok) return NextResponse.json({ error: 'Lead no trobat' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { updateUserSubscription } from '@/lib/users';
import { z } from 'zod';

type S = { user?: { role?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

const Schema = z.object({
  subscriptionPlan:   z.enum(['free', 'active', 'premium']),
  subscriptionStatus: z.enum(['active', 'inactive', 'suspended']),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const ok = updateUserSubscription(id, parsed.data.subscriptionPlan, parsed.data.subscriptionStatus);
  if (!ok) return NextResponse.json({ error: 'Usuari no trobat' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

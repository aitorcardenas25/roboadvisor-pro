import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { updateUserSubscription, updateUserName } from '@/lib/users';
import { logAuditEvent } from '@/lib/auditLog';
import { z } from 'zod';

type S = { user?: { role?: string; id?: string; email?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

const SubscriptionSchema = z.object({
  subscriptionPlan:   z.enum(['free', 'active', 'premium']),
  subscriptionStatus: z.enum(['active', 'inactive', 'suspended']),
});

// Nom complet (nom + cognoms): és el que surt a la portada i a les capçaleres dels informes.
const NameSchema = z.object({
  name: z.string().trim().min(2, 'El nom és massa curt').max(100, 'El nom és massa llarg'),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }

  if (body && typeof body === 'object' && 'name' in body) {
    const parsed = NameSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const name = parsed.data.name.replace(/\s+/g, ' ');
    const ok = await updateUserName(id, name);
    if (!ok) return NextResponse.json({ error: 'Usuari no trobat' }, { status: 404 });
    logAuditEvent('client.name_changed', {
      userId: session?.user?.id, userEmail: session?.user?.email, resource: id,
      metadata: { by: 'admin' },
    });
    return NextResponse.json({ ok: true, name });
  }

  const parsed = SubscriptionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const ok = await updateUserSubscription(id, parsed.data.subscriptionPlan, parsed.data.subscriptionStatus);
  if (!ok) return NextResponse.json({ error: 'Usuari no trobat' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/lib/notifications';
import { z } from 'zod';

type S = { user?: { role?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '50');
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(Math.min(limit, 100)),
    getUnreadCount(),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

const PatchSchema = z.object({
  id:  z.string().optional(),
  all: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  if (parsed.data.all) { await markAllAsRead(); return NextResponse.json({ ok: true }); }
  if (parsed.data.id)  { await markAsRead(parsed.data.id); return NextResponse.json({ ok: true }); }

  return NextResponse.json({ error: 'Cal indicar id o all:true' }, { status: 400 });
}

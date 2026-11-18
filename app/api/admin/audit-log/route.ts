import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAuditLog, AuditAction } from '@/lib/auditLog';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const limit  = Math.min(Number(searchParams.get('limit') ?? 100), 500);
  const action = searchParams.get('action') as AuditAction | null;
  const userId = searchParams.get('userId') ?? undefined;
  const since  = searchParams.get('since')  ?? undefined;
  const search = searchParams.get('search') ?? undefined;

  const entries = await getAuditLog({ limit, action: action ?? undefined, userId, since, search });
  // Les estadístiques surten de les entrades llegides (Supabase), no de la memòria
  // del procés: a Vercel cada petició pot anar a una instància nova i la memòria és buida.
  const byAction: Record<string, number> = {};
  for (const e of entries) byAction[e.action] = (byAction[e.action] ?? 0) + 1;
  const stats = { total: entries.length, byAction };

  return NextResponse.json({ entries, stats });
}

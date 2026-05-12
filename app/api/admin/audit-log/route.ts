import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAuditLog, auditLogStats, AuditAction } from '@/lib/auditLog';

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

  const entries = getAuditLog({ limit, action: action ?? undefined, userId, since, search });
  const stats   = auditLogStats();

  return NextResponse.json({ entries, stats });
}

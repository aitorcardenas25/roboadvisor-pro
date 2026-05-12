import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  getAllUsers, createAuthorizedUser, updateUserRole, deactivateUser,
  AppUser,
} from '@/lib/users';
import type { UserRole } from '@/lib/roles';
import { logAuditEvent } from '@/lib/auditLog';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rateLimiter';

type SessionLike = { user?: { role?: string; id?: string; email?: string } } | null;

function isAdmin(session: SessionLike): boolean {
  return (session?.user as { role?: string } | undefined)?.role === 'admin';
}

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions) as SessionLike;
  if (!isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ users: getAllUsers() });
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const rl = rateLimit(`clients-post:${ip}`, LIMITS.adminApi.maxRequests, LIMITS.adminApi.windowMs);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs) as unknown as NextResponse;

  const session = await getServerSession(authOptions) as SessionLike;
  if (!isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Partial<Omit<AppUser, 'id' | 'createdAt'>>;
  const { username, password, name, email, role } = body;
  if (!username || !password || !name || !email)
    return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 });

  const user = createAuthorizedUser({
    username, password, name, email,
    role: (role ?? 'authorized') as UserRole,
    active: true,
  });

  logAuditEvent('client.created', {
    userId:    session?.user?.id,
    userEmail: session?.user?.email,
    resource:  user.id,
    metadata:  { name: user.name, email: user.email, role: user.role },
    ip,
  });

  return NextResponse.json({ user }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const ip = getIp(req);
  const session = await getServerSession(authOptions) as SessionLike;
  if (!isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, role } = await req.json() as { id: string; role: UserRole };
  if (!id || !role) return NextResponse.json({ error: 'Falten camps' }, { status: 400 });

  const ok = updateUserRole(id, role);
  if (!ok) return NextResponse.json({ error: 'Usuari no trobat' }, { status: 404 });

  logAuditEvent('client.role_changed', {
    userId:    session?.user?.id,
    userEmail: session?.user?.email,
    resource:  id,
    metadata:  { newRole: role },
    ip,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const ip = getIp(req);
  const session = await getServerSession(authOptions) as SessionLike;
  if (!isAdmin(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const ok = deactivateUser(id);
  if (!ok) return NextResponse.json({ error: 'Usuari no trobat' }, { status: 404 });

  logAuditEvent('client.deactivated', {
    userId:    session?.user?.id,
    userEmail: session?.user?.email,
    resource:  id,
    ip,
  });

  return NextResponse.json({ ok: true });
}

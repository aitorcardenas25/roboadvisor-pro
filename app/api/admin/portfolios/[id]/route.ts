import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getPortfolioById, updatePortfolio, deletePortfolio } from '@/lib/adminPortfolios';

function isAdmin(s: { user?: { role?: string } } | null) {
  return s?.user?.role === 'admin';
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  const { id } = await params;
  const p = getPortfolioById(id);
  if (!p) return NextResponse.json({ error: 'No trobada.' }, { status: 404 });
  return NextResponse.json({ portfolio: p });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  const { id } = await params;
  const body    = await req.json();
  const updated = updatePortfolio(id, body);
  if (!updated) return NextResponse.json({ error: 'No trobada.' }, { status: 404 });
  return NextResponse.json({ portfolio: updated });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  const { id } = await params;
  if (!deletePortfolio(id)) return NextResponse.json({ error: 'No trobada.' }, { status: 404 });
  return NextResponse.json({ success: true });
}

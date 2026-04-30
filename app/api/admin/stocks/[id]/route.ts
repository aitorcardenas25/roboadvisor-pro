import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { updateStock, deleteStock } from '@/lib/stockTracker';

function isAdmin(s: { user?: { role?: string } } | null) {
  return s?.user?.role === 'admin';
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  const { id } = await params;
  const body    = await req.json();
  const updated = updateStock(id, body);
  if (!updated) return NextResponse.json({ error: 'No trobat.' }, { status: 404 });
  return NextResponse.json({ stock: updated });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  const { id } = await params;
  if (!deleteStock(id)) return NextResponse.json({ error: 'No trobat.' }, { status: 404 });
  return NextResponse.json({ success: true });
}

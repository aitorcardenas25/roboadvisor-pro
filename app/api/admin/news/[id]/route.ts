import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { updateNews, deleteNews } from '@/lib/news';

function isAdmin(s: { user?: { role?: string } } | null) {
  return s?.user?.role === 'admin';
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  const { id } = await params;
  const body    = await req.json();

  if (body.status === 'published' && !body.publishedAt) {
    body.publishedAt = new Date().toISOString().split('T')[0];
  }

  const updated = updateNews(id, body);
  if (!updated) return NextResponse.json({ error: 'No trobada.' }, { status: 404 });
  return NextResponse.json({ article: updated });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  const { id } = await params;
  const ok = deleteNews(id);
  if (!ok) return NextResponse.json({ error: 'No trobada.' }, { status: 404 });
  return NextResponse.json({ success: true });
}

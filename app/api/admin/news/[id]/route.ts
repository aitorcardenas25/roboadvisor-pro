import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { updateNews, deleteNews } from '@/lib/news';
import { validateBody } from '@/lib/validate';
import { UpdateNewsSchema } from '@/lib/schemas';

function isAdmin(s: { user?: { role?: string } } | null) {
  return s?.user?.role === 'admin';
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  const v = await validateBody(req, UpdateNewsSchema);
  if (!v.ok) return v.response;

  const { id } = await params;
  const data = { ...v.data };
  if (data.status === 'published' && !data.publishedAt) {
    data.publishedAt = new Date().toISOString().split('T')[0];
  }

  const updated = updateNews(id, data);
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

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllNews, createNews } from '@/lib/news';
import { validateBody } from '@/lib/validate';
import { CreateNewsSchema } from '@/lib/schemas';

function isAdmin(s: { user?: { role?: string } } | null) {
  return s?.user?.role === 'admin';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  return NextResponse.json({ news: getAllNews() });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  const v = await validateBody(req, CreateNewsSchema);
  if (!v.ok) return v.response;

  const now = new Date().toISOString().split('T')[0];
  const article = createNews({
    ...v.data,
    publishedAt: v.data.status === 'published' ? now : (v.data.publishedAt ?? now),
  });
  return NextResponse.json({ article }, { status: 201 });
}

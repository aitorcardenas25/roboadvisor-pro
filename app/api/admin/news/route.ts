import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllNews, createNews } from '@/lib/news';

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

  const body = await req.json();
  if (!body.title || !body.summary || !body.category) {
    return NextResponse.json({ error: 'Títol, resum i categoria obligatoris.' }, { status: 400 });
  }

  const now = new Date().toISOString().split('T')[0];
  const article = createNews({
    title:       body.title,
    summary:     body.summary,
    content:     body.content ?? '',
    category:    body.category,
    source:      body.source ?? 'Factor OTC',
    author:      body.author ?? 'Equip Factor OTC',
    status:      body.status ?? 'draft',
    featured:    body.featured ?? false,
    externalUrl: body.externalUrl ?? '',
    publishedAt: body.status === 'published' ? now : (body.publishedAt ?? now),
  });
  return NextResponse.json({ article }, { status: 201 });
}

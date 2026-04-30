import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllNewsletters, createNewsletter } from '@/lib/newsletter';

function isAdmin(session: { user?: { role?: string } } | null) {
  return (session?.user as { role?: string })?.role === 'admin';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  return NextResponse.json({ newsletters: getAllNewsletters() });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  const { title, subject, sections } = await req.json();
  if (!title || !subject) return NextResponse.json({ error: 'Títol i assumpte obligatoris.' }, { status: 400 });

  const nl = createNewsletter(title, subject, sections);
  return NextResponse.json({ newsletter: nl }, { status: 201 });
}

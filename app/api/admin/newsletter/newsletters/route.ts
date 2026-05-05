import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllNewsletters, createNewsletter } from '@/lib/newsletter';
import { validateBody } from '@/lib/validate';
import { CreateNewsletterSchema } from '@/lib/schemas';

function isAdmin(session: { user?: { role?: string } } | null) {
  return (session?.user as { role?: string })?.role === 'admin';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  return NextResponse.json({ newsletters: await getAllNewsletters() });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  const v = await validateBody(req, CreateNewsletterSchema);
  if (!v.ok) return v.response;

  const nl = await createNewsletter(v.data.title, v.data.subject, v.data.sections);
  return NextResponse.json({ newsletter: nl }, { status: 201 });
}

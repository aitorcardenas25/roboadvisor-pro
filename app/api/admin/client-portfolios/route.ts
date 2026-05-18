import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllClientPortfolios, createClientPortfolio } from '@/lib/clientPortfolios';
import { z } from 'zod';

type S = { user?: { role?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

const CreateSchema = z.object({
  clientId:        z.string().min(1),
  clientName:      z.string().min(1).max(100),
  name:            z.string().min(1).max(150),
  description:     z.string().max(500).default(''),
  recommendations: z.string().max(2000).default(''),
});

export async function GET() {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  return NextResponse.json({ portfolios: await getAllClientPortfolios() });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const portfolio = await createClientPortfolio(parsed.data);
  return NextResponse.json({ portfolio }, { status: 201 });
}

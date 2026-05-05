import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllPortfolios, createPortfolio } from '@/lib/adminPortfolios';
import { validateBody } from '@/lib/validate';
import { CreatePortfolioSchema } from '@/lib/schemas';

function isAdmin(s: { user?: { role?: string } } | null) {
  return s?.user?.role === 'admin';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  return NextResponse.json({ portfolios: await getAllPortfolios() });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  const v = await validateBody(req, CreatePortfolioSchema);
  if (!v.ok) return v.response;

  const portfolio = await createPortfolio(v.data);
  return NextResponse.json({ portfolio }, { status: 201 });
}

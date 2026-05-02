import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllPortfolios, createPortfolio } from '@/lib/adminPortfolios';

function isAdmin(s: { user?: { role?: string } } | null) {
  return s?.user?.role === 'admin';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  return NextResponse.json({ portfolios: getAllPortfolios() });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  const body = await req.json();
  if (!body.name || !body.recommendedProfile) {
    return NextResponse.json({ error: 'Nom i perfil obligatoris.' }, { status: 400 });
  }

  const portfolio = createPortfolio({
    name:               body.name,
    description:        body.description        ?? '',
    recommendedProfile: body.recommendedProfile,
    horizon:            body.horizon            ?? '5–10 anys',
    assets:             body.assets             ?? [],
    justification:      body.justification      ?? '',
    status:             body.status             ?? 'draft',
  });
  return NextResponse.json({ portfolio }, { status: 201 });
}

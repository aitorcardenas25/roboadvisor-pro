import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllStocks, createStock } from '@/lib/stockTracker';

function isAdmin(s: { user?: { role?: string } } | null) {
  return s?.user?.role === 'admin';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  return NextResponse.json({ stocks: getAllStocks() });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  const body = await req.json();
  if (!body.symbol || !body.name) {
    return NextResponse.json({ error: 'Symbol i nom obligatoris.' }, { status: 400 });
  }

  const stock = createStock({
    symbol:          body.symbol.toUpperCase(),
    name:            body.name,
    sector:          body.sector          ?? '',
    region:          body.region          ?? 'Global',
    currency:        body.currency        ?? 'EUR',
    signal:          body.signal          ?? 'neutral',
    signalNote:      body.signalNote      ?? '',
    technicalNote:   body.technicalNote   ?? '',
    fundamentalNote: body.fundamentalNote ?? '',
    active:          body.active          ?? true,
  });
  return NextResponse.json({ stock }, { status: 201 });
}

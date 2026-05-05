import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllStocks, createStock } from '@/lib/stockTracker';
import { validateBody } from '@/lib/validate';
import { CreateStockSchema } from '@/lib/schemas';

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

  const v = await validateBody(req, CreateStockSchema);
  if (!v.ok) return v.response;

  const stock = createStock(v.data);
  return NextResponse.json({ stock }, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }  from 'next-auth';
import { authOptions }       from '@/lib/authOptions';
import { getStockBySymbol }  from '@/lib/stockTracker';
import { getQuote }          from '@/services/quotes';

export async function GET(_: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'authorized' && role !== 'admin') {
    return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  }

  const { symbol } = await params;
  const stock = getStockBySymbol(symbol);
  if (!stock) return NextResponse.json({ error: 'Acció no trobada.' }, { status: 404 });

  // Intentem obtenir quote en temps real (no bloquejant)
  let quote = null;
  try { quote = await getQuote(symbol); } catch { /* ok, opcional */ }

  return NextResponse.json({ stock, quote });
}

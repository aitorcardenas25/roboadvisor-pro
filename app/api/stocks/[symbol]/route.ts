import { NextRequest, NextResponse } from 'next/server';
import { getStockBySymbol } from '@/lib/stockTracker';
import { getQuote } from '@/services/quotes';

export async function GET(_: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const stock = getStockBySymbol(symbol);
  if (!stock) return NextResponse.json({ error: 'Acció no trobada.' }, { status: 404 });

  // Intentem obtenir quote en temps real (no bloquejant)
  let quote = null;
  try { quote = await getQuote(symbol); } catch { /* ok, opcional */ }

  return NextResponse.json({ stock, quote });
}

import { NextRequest, NextResponse } from 'next/server';
import { getQuote, getBatchQuotes } from '@/services/quotes';

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get('symbols') ?? req.nextUrl.searchParams.get('symbol') ?? '';
  if (!symbols.trim()) return NextResponse.json({ error: 'symbols requerit' }, { status: 400 });

  const list = symbols.split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);

  try {
    if (list.length === 1) {
      const quote = await getQuote(list[0]);
      return NextResponse.json({ quote });
    }
    const quotes = await getBatchQuotes(list);
    return NextResponse.json({ quotes });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

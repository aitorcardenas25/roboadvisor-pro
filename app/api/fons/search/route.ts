import { NextRequest, NextResponse } from 'next/server';
import { FINANCIAL_PRODUCTS } from '@/lib/products';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';
  if (q.length < 2) return NextResponse.json({ results: [] });

  const results = FINANCIAL_PRODUCTS.filter(p =>
    p.isin.toLowerCase().includes(q) ||
    p.name.toLowerCase().includes(q) ||
    p.manager.toLowerCase().includes(q) ||
    (p.dataIdentifier ?? '').toLowerCase().includes(q)
  ).slice(0, 10).map(p => ({
    id:       p.id,
    name:     p.name,
    isin:     p.isin,
    manager:  p.manager,
    category: p.category,
    risk:     p.risk,
  }));

  return NextResponse.json({ results });
}

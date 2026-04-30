import { NextRequest, NextResponse } from 'next/server';
import { getProductData } from '@/services/financialData';
import { FINANCIAL_PRODUCTS } from '@/lib/products';

export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get('productId') ?? '';
  const period    = (req.nextUrl.searchParams.get('period') ?? '5y') as '1y' | '2y' | '5y';

  if (!productId) return NextResponse.json({ error: 'productId requerit' }, { status: 400 });

  const product = FINANCIAL_PRODUCTS.find(p => p.id === productId || p.isin === productId);
  const isin    = product?.isin ?? productId;

  try {
    const result = await getProductData(productId, isin, period);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

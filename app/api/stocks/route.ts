import { NextResponse } from 'next/server';
import { getActiveStocks } from '@/lib/stockTracker';

export async function GET() {
  return NextResponse.json({ stocks: getActiveStocks() });
}

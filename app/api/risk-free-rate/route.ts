// app/api/risk-free-rate/route.ts
// Returns the current EUR risk-free rate from the ECB SDW API.
// Cached by Next.js for 24h; falls back to 3.0% if ECB is unreachable.

export const revalidate = 86400; // 24h

import { NextResponse } from 'next/server';
import { getRiskFreeRateWithMeta } from '@/lib/ecbApi';

export async function GET() {
  const { rate, source, fetchedAt } = await getRiskFreeRateWithMeta();
  return NextResponse.json({ rate, source, fetchedAt });
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getPublishedStockReports } from '@/lib/stockReports';

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'public';
  const reports = await getPublishedStockReports(role);
  return NextResponse.json({ reports });
}

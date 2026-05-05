import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getActivePortfolios } from '@/lib/adminPortfolios';

function isAuthorized(s: { user?: { role?: string } } | null) {
  return s?.user?.role === 'authorized' || s?.user?.role === 'admin';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAuthorized(session)) {
    return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  }
  return NextResponse.json({ portfolios: await getActivePortfolios() });
}

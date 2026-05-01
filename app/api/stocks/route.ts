import { NextResponse }   from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions }      from '@/lib/authOptions';
import { getActiveStocks }  from '@/lib/stockTracker';

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'authorized' && role !== 'admin') {
    return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  }
  return NextResponse.json({ stocks: getActiveStocks() });
}

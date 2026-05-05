import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllSubscribers } from '@/lib/newsletter';

export async function GET() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  }
  return NextResponse.json({ subscribers: await getAllSubscribers() });
}

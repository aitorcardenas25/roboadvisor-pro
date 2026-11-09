// POST → "segueixo connectat": el navegador l'envia cada minut mentre la pàgina és visible.
// Serveix per calcular el temps connectat de cada client a la beta.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { recordActivity } from '@/lib/betaActivity';
import { rateLimit } from '@/lib/rateLimiter';

type S = { user?: { id?: string; role?: string } } | null;
const BodySchema = z.object({ page: z.enum(['finances', 'cartera', 'altres']).default('altres') });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  const userId = session?.user?.id;
  // Només es mesura els clients; l'admin no compta.
  if (!userId || session?.user?.role !== 'client') return new NextResponse(null, { status: 204 });
  // Com a màxim 2 pings per minut per client: no es poden inflar els minuts.
  if (!rateLimit(`client-ping:${userId}`, 2, 60_000).ok) return new NextResponse(null, { status: 204 });
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  recordActivity(userId, 'ping', new Date(), parsed.success ? parsed.data.page : 'altres');
  return new NextResponse(null, { status: 204 });
}

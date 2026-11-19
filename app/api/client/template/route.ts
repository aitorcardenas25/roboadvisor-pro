// GET → el client descarrega la seva plantilla Excel (la mateixa que l'assessor
// li enviaria), amb el seu nom. No conté cap dada: només les preguntes.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { buildTemplate } from '@/lib/clientImport';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimiter';
import { recordActivity } from '@/lib/betaActivity';

type S = { user?: { id?: string; name?: string; role?: string } } | null;

export async function GET() {
  const session = await getServerSession(authOptions) as S;
  const u = session?.user;
  if (!u?.id || (u.role !== 'client' && u.role !== 'admin')) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }
  const rl = rateLimit(`client-template:${u.id}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs);
  if (u.role === 'client') recordActivity(u.id, 'template.download');

  const name = u.name ?? '';
  const buf  = await buildTemplate(name || undefined);
  const safe = name.normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'client';
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="FACTOR_OTC_plantilla_${safe}.xlsx"`,
      'Cache-Control':       'no-store',
    },
  });
}

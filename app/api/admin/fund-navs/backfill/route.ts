// Històric diari complet des de la font oficial de cada fons (lib/navBackfill.ts).
// GET  → fons que es poden carregar
// POST → { isin } carrega l'històric d'un fons (l'admin els va fent d'un en un)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { logAuditEvent } from '@/lib/auditLog';
import { isIsin } from '@/lib/navMath';
import { backfillCandidates, backfillFund } from '@/lib/navBackfill';

export const maxDuration = 300;

type S = { user?: { id?: string; email?: string; role?: string } } | null;
const admin = async () => { const s = await getServerSession(authOptions) as S; return s?.user?.role === 'admin' ? s : null; };
const Body = z.object({ isin: z.string().trim().toUpperCase().refine(isIsin, 'ISIN no vàlid') });

export async function GET() {
  if (!await admin()) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  try { return NextResponse.json({ funds: await backfillCandidates() }); }
  catch (err) {
    console.error('[admin/fund-navs/backfill]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'No s\'ha pogut llegir la llista de fons' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await admin();
  if (!session) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ISIN no vàlid' }, { status: 400 });
  const result = await backfillFund(parsed.data.isin);
  console.log(`[navBackfill] ${result.status} ${result.isin} ${result.source} +${result.added} des de ${result.firstDate ?? '-'} ${result.message ?? ''}`);
  logAuditEvent('fund.navs_backfill', {
    userId: session.user?.id, userEmail: session.user?.email, resource: 'fund_navs',
    metadata: result as unknown as Record<string, unknown>,
  });
  return NextResponse.json({ result });
}

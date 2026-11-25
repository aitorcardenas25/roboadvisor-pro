// Actualització automàtica dels preus dels fons, vista des de l'admin.
// GET  → resum de l'última execució (diària a les 13:00 o manual)
// POST → executa-la ara (només admin; com a màxim una cada 5 minuts)
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { lastAutoUpdate, ranRecently, runNavAutoUpdate } from '@/lib/navAutoUpdate';

export const maxDuration = 300;

type S = { user?: { role?: string } } | null;
const isAdmin = async () => ((await getServerSession(authOptions)) as S)?.user?.role === 'admin';

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  try {
    return NextResponse.json({ last: await lastAutoUpdate(), cronConfigured: !!process.env.CRON_SECRET });
  } catch {
    return NextResponse.json({ error: 'No s\'ha pogut llegir l\'última actualització' }, { status: 500 });
  }
}

export async function POST() {
  if (!await isAdmin()) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  if (await ranRecently(5).catch(() => false)) {
    return NextResponse.json({ error: 'S\'ha actualitzat fa menys de 5 minuts. Torna-ho a provar d\'aquí a una estona.' }, { status: 429 });
  }
  try {
    return NextResponse.json({ last: await runNavAutoUpdate('admin') });
  } catch (err) {
    console.error('[admin/fund-navs/auto]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'No s\'ha pogut fer l\'actualització' }, { status: 500 });
  }
}

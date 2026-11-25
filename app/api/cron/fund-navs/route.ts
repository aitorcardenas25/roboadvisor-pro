// Tasca programada de Vercel (vercel.json → crons): cada dia a les 12:00 UTC,
// és a dir, a les 13:00 de Madrid a l'hivern (14:00 a l'estiu), descarrega els
// valors liquidatius oficials del dia anterior i els desa a fund_navs.
//
// Seguretat: si hi ha la variable CRON_SECRET, Vercel l'envia com a
// "Authorization: Bearer …" i aquí es comprova. Sense CRON_SECRET només
// s'accepta la crida de l'agent de Vercel i, en tots dos casos, com a màxim una
// execució cada 30 minuts (la ruta només llegeix webs públiques de gestores).
import { NextRequest, NextResponse } from 'next/server';
import { ranRecently, runNavAutoUpdate } from '@/lib/navAutoUpdate';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  const fromVercel = /vercel-cron/i.test(req.headers.get('user-agent') ?? '');
  if (secret ? auth !== `Bearer ${secret}` : !fromVercel) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }
  if (await ranRecently(30).catch(() => false)) {
    return NextResponse.json({ ok: true, skipped: 'Ja s\'ha executat fa menys de 30 minuts' });
  }
  try {
    const summary = await runNavAutoUpdate('cron');
    return NextResponse.json({ ok: true, counts: summary.counts, holdingsUpdated: summary.holdingsUpdated });
  } catch (err) {
    console.error('[cron/fund-navs]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'No s\'ha pogut fer l\'actualització' }, { status: 500 });
  }
}

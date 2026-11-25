// Tasca programada de Vercel (vercel.json → crons): cada dia a les 12:00 UTC,
// és a dir, a les 13:00 de Madrid a l'hivern (14:00 a l'estiu), descarrega els
// valors liquidatius oficials del dia anterior i els desa a fund_navs.
//
// Seguretat: cal la variable CRON_SECRET a Vercel. Vercel l'envia com a
// "Authorization: Bearer …" i aquí es comprova. Sense la variable, la ruta no
// s'executa mai (la capçalera user-agent la pot posar qualsevol). A més, com a
// màxim una execució cada 30 minuts.
import { NextRequest, NextResponse } from 'next/server';
import { ranRecently, runNavAutoUpdate } from '@/lib/navAutoUpdate';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/fund-navs] falta la variable CRON_SECRET a Vercel: no s\'actualitzen els preus');
    return NextResponse.json({ error: 'Falta configurar CRON_SECRET' }, { status: 503 });
  }
  if ((req.headers.get('authorization') ?? '') !== `Bearer ${secret}`) {
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

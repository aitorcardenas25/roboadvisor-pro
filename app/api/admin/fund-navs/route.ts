// Preus dels fons entrats a mà per l'admin (beta sense API de dades).
// GET            → resum per fons (mètriques) · ?isin=X → preus d'un fons
// POST (JSON)    → { text, isin?, currency?, mode: 'preview' | 'commit' }
// POST (fitxer)  → multipart: file (.xlsx/.csv/.txt), isin?, currency?, mode
// DELETE         → ?isin=X&date=aaaa-mm-dd (un preu) · ?isin=X&all=true (tots)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { logAuditEvent } from '@/lib/auditLog';
import { computeNavMetrics, isIsin, parseNavText, type NavPoint } from '@/lib/navMath';
import { currencyConflicts, deleteNavs, getNavs, getNavSummary, upsertNavs, workbookToText } from '@/lib/fundNavs';
import { syncHoldingsToNavs } from '@/lib/clientPortfolios';

type S = { user?: { id?: string; email?: string; role?: string } } | null;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS  = 20_000;

const BodySchema = z.object({
  text:     z.string().max(2_000_000),
  isin:     z.string().trim().toUpperCase().optional().refine(v => !v || isIsin(v), 'ISIN no vàlid'),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  mode:     z.enum(['preview', 'commit']),
});

async function admin(): Promise<S | null> {
  const session = await getServerSession(authOptions) as S;
  return session?.user?.role === 'admin' ? session : null;
}

const dbError = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  const missing = /fund_navs/.test(msg) && /(does not exist|not find|schema cache)/i.test(msg);
  return NextResponse.json({
    error: missing
      ? 'Falta crear la taula de preus a Supabase (fitxer db/migrations/2026-11-16_fund_navs.sql).'
      : 'No s\'ha pogut accedir a la base de dades.',
  }, { status: 500 });
};

export async function GET(req: NextRequest) {
  if (!await admin()) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const isin = new URL(req.url).searchParams.get('isin')?.trim().toUpperCase();
  try {
    if (isin) {
      if (!isIsin(isin)) return NextResponse.json({ error: 'ISIN no vàlid' }, { status: 400 });
      const points = await getNavs(isin);
      return NextResponse.json({ isin, points, metrics: computeNavMetrics(points) });
    }
    return NextResponse.json({ funds: await getNavSummary() });
  } catch (err) { return dbError(err); }
}

export async function POST(req: NextRequest) {
  const session = await admin();
  if (!session) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  let input: unknown;
  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    let form: FormData;
    try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Formulari no vàlid' }, { status: 400 }); }
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el fitxer' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'El fitxer és massa gran (màx. 5 MB)' }, { status: 413 });
    const lower = file.name.toLowerCase();
    let text: string;
    try {
      if (lower.endsWith('.xlsx')) text = await workbookToText(await file.arrayBuffer());
      else if (/\.(csv|txt|tsv)$/.test(lower)) text = await file.text();
      else return NextResponse.json({ error: 'Formats acceptats: .xlsx, .csv o .txt' }, { status: 400 });
    } catch { return NextResponse.json({ error: 'No s\'ha pogut llegir el fitxer' }, { status: 400 }); }
    input = {
      text, mode: form.get('mode'),
      isin: (form.get('isin') as string | null) || undefined,
      currency: (form.get('currency') as string | null) || undefined,
    };
  } else {
    input = await req.json().catch(() => null);
  }

  const parsed = BodySchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: 'Dades no vàlides', issues: parsed.error.issues }, { status: 400 });
  const { text, isin, currency, mode } = parsed.data;

  const res = parseNavText(text, { defaultIsin: isin, defaultCurrency: currency });
  if (res.rows.length > MAX_ROWS) return NextResponse.json({ error: `Massa files (${res.rows.length}); màxim ${MAX_ROWS} per cop` }, { status: 413 });

  let conflicts: string[];
  try { conflicts = await currencyConflicts(res.rows); } catch (err) { return dbError(err); }
  const errors = [...res.errors, ...conflicts.map(message => ({ line: 0, message }))];

  const byFund = new Map<string, NavPoint[]>();
  for (const r of res.rows) byFund.set(r.isin, [...(byFund.get(r.isin) ?? []), r]);
  const funds = [...byFund].map(([k, rows]) => {
    const dates = rows.map(r => r.date).sort();
    return { isin: k, count: rows.length, from: dates[0], to: dates.at(-1)!, currency: rows[0].currency };
  });

  if (mode === 'preview' || errors.length) {
    return NextResponse.json({ ok: !errors.length, rows: res.rows.slice(0, 500), total: res.rows.length, funds, errors, warnings: res.warnings },
      { status: mode === 'commit' ? 422 : 200 });
  }
  if (!res.rows.length) return NextResponse.json({ error: 'No hi ha cap preu per desar' }, { status: 400 });

  try {
    const saved = await upsertNavs(res.rows);
    // L'últim preu de cada fons passa a les posicions dels clients
    const latest = await Promise.all(funds.map(async f => {
      const last = (await getNavs(f.isin)).at(-1)!;
      return { isin: f.isin, date: last.date, nav: last.nav, currency: last.currency };
    }));
    const holdingsUpdated = await syncHoldingsToNavs(latest).catch(err => {
      console.error('[fund-navs] no s\'han pogut actualitzar les posicions:', err instanceof Error ? err.message : err);
      return 0;
    });
    logAuditEvent('fund.navs_saved', {
      userId: session.user?.id, userEmail: session.user?.email,
      metadata: { rows: saved, funds: funds.map(f => f.isin), holdingsUpdated },
    });
    return NextResponse.json({ ok: true, saved, funds, holdingsUpdated, warnings: res.warnings });
  } catch (err) { return dbError(err); }
}

export async function DELETE(req: NextRequest) {
  const session = await admin();
  if (!session) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const isin = sp.get('isin')?.trim().toUpperCase() ?? '';
  const date = sp.get('date')?.trim() || undefined;
  if (!isIsin(isin)) return NextResponse.json({ error: 'ISIN no vàlid' }, { status: 400 });
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Data no vàlida' }, { status: 400 });
  if (!date && sp.get('all') !== 'true') return NextResponse.json({ error: 'Cal una data o all=true' }, { status: 400 });
  try {
    const deleted = await deleteNavs(isin, date);
    logAuditEvent('fund.navs_deleted', {
      userId: session.user?.id, userEmail: session.user?.email, resource: isin,
      metadata: { date: date ?? 'tots', deleted },
    });
    return NextResponse.json({ ok: true, deleted });
  } catch (err) { return dbError(err); }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getMonthlyReportsByPortfolio, getAllMonthlyReports, markMonthlyReportSent } from '@/lib/monthlyReports';
import { z } from 'zod';

type S = { user?: { role?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const portfolioId = req.nextUrl.searchParams.get('portfolioId');
  const records = portfolioId
    ? await getMonthlyReportsByPortfolio(portfolioId)
    : await getAllMonthlyReports();

  return NextResponse.json({ reports: records });
}

const PatchSchema = z.object({ id: z.string().min(1) });

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const ok = await markMonthlyReportSent(parsed.data.id);
  if (!ok) return NextResponse.json({ error: 'Informe no trobat' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

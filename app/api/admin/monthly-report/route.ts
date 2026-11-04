import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getPortfolioById } from '@/lib/clientPortfolios';
import { generateMonthlyReportData } from '@/lib/portfolioReport';
import { saveMonthlyReport } from '@/lib/monthlyReports';
import { z } from 'zod';

type S = { user?: { role?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

const Schema = z.object({
  portfolioId:     z.string().min(1),
  periodStart:     z.string().min(1),
  periodEnd:       z.string().min(1),
  advisorComments: z.string().default(''),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const portfolio = await getPortfolioById(parsed.data.portfolioId);
  if (!portfolio) return NextResponse.json({ error: 'Cartera no trobada' }, { status: 404 });

  const report = generateMonthlyReportData(
    portfolio,
    parsed.data.advisorComments,
    parsed.data.periodStart,
    parsed.data.periodEnd,
  );

  // Guardar informe (fire-and-forget, no bloqueja la resposta)
  saveMonthlyReport({
    portfolioId: portfolio.id,
    clientId:    portfolio.clientId,
    clientName:  portfolio.clientName,
    periodStart: parsed.data.periodStart,
    periodEnd:   parsed.data.periodEnd,
    data:        report,
  }).catch(() => {});

  return NextResponse.json({ report });
}

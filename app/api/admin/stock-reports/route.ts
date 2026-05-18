import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllStockReports, createStockReport } from '@/lib/stockReports';
import { z } from 'zod';

type S = { user?: { role?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const reports = await getAllStockReports();
  return NextResponse.json({ reports });
}

const CreateSchema = z.object({
  ticker:        z.string().min(1).max(20).toUpperCase(),
  company:       z.string().min(1).max(200),
  sector:        z.string().max(100).default(''),
  rating:        z.enum(['buy', 'hold', 'avoid', 'watch']),
  summary:       z.string().max(2000).default(''),
  fundamentals:  z.string().max(5000).default(''),
  technicals:    z.string().max(5000).default(''),
  risks:         z.string().max(2000).default(''),
  conclusion:    z.string().max(2000).default(''),
  targetPrice:   z.number().positive().optional(),
  currentPrice:  z.number().nonnegative().optional(),
  currency:      z.string().default('EUR'),
  status:        z.enum(['draft', 'published']).default('draft'),
  visibleTo:     z.enum(['all', 'clients']).default('clients'),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const report = await createStockReport(parsed.data);
  return NextResponse.json({ report }, { status: 201 });
}

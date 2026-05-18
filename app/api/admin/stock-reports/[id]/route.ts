import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getStockReportById, updateStockReport, deleteStockReport } from '@/lib/stockReports';
import { z } from 'zod';

type S = { user?: { role?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const { id } = await params;
  const report = await getStockReportById(id);
  if (!report) return NextResponse.json({ error: 'No trobat' }, { status: 404 });
  return NextResponse.json({ report });
}

const UpdateSchema = z.object({
  ticker:        z.string().min(1).max(20).toUpperCase().optional(),
  company:       z.string().min(1).max(200).optional(),
  sector:        z.string().max(100).optional(),
  rating:        z.enum(['buy', 'hold', 'avoid', 'watch']).optional(),
  summary:       z.string().max(2000).optional(),
  fundamentals:  z.string().max(5000).optional(),
  technicals:    z.string().max(5000).optional(),
  risks:         z.string().max(2000).optional(),
  conclusion:    z.string().max(2000).optional(),
  targetPrice:   z.number().positive().nullable().optional(),
  currentPrice:  z.number().nonnegative().nullable().optional(),
  currency:      z.string().optional(),
  status:        z.enum(['draft', 'published']).optional(),
  visibleTo:     z.enum(['all', 'clients']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const report = await updateStockReport(id, parsed.data as Parameters<typeof updateStockReport>[1]);
  if (!report) return NextResponse.json({ error: 'No trobat' }, { status: 404 });
  return NextResponse.json({ report });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const { id } = await params;
  const ok = await deleteStockReport(id);
  if (!ok) return NextResponse.json({ error: 'No trobat' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

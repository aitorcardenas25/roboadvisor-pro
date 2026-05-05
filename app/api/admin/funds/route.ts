import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  getAllFunds, getFundById,
  createFund, updateFund,
  deleteFund, getFundStats,
} from '@/lib/adminFunds';
import type { AdminFund } from '@/lib/adminFunds';
import { validateBody } from '@/lib/validate';
import { CreateFundSchema, UpdateFundSchema } from '@/lib/schemas';

async function checkAuth() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  return null;
}

export async function GET(req: NextRequest) {
  const authError = await checkAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    const fund = getFundById(id);
    if (!fund) return NextResponse.json({ error: 'Fons no trobat' }, { status: 404 });
    return NextResponse.json(fund);
  }

  return NextResponse.json({ funds: getAllFunds(), stats: getFundStats() });
}

export async function POST(req: NextRequest) {
  const authError = await checkAuth();
  if (authError) return authError;

  const v = await validateBody(req, CreateFundSchema);
  if (!v.ok) return v.response;

  try {
    const newFund = createFund({ ...v.data, active: true } as Omit<AdminFund, 'id' | 'createdAt' | 'updatedAt'>);
    return NextResponse.json(newFund, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error creant el fons' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authError = await checkAuth();
  if (authError) return authError;

  const v = await validateBody(req, UpdateFundSchema);
  if (!v.ok) return v.response;

  const { id, ...updates } = v.data as Record<string, unknown>;
  try {
    const updated = updateFund(id as string, updates);
    if (!updated) return NextResponse.json({ error: 'Fons no trobat' }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Error actualitzant el fons' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = await checkAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id és obligatori' }, { status: 400 });

  const deleted = deleteFund(id);
  if (!deleted) return NextResponse.json({ error: 'Fons no trobat' }, { status: 404 });
  return NextResponse.json({ success: true, deletedId: id });
}

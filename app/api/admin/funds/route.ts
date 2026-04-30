// app/api/admin/funds/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }          from 'next-auth';
import {
  getAllFunds, getFundById,
  createFund, updateFund,
  deleteFund, getFundStats,
} from '@/lib/adminFunds';

// Middleware d'autenticació
async function checkAuth() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }
  return null;
}

// GET — Llista tots els fons
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

  const funds = getAllFunds();
  const stats = getFundStats();
  return NextResponse.json({ funds, stats });
}

// POST — Crear nou fons
export async function POST(req: NextRequest) {
  const authError = await checkAuth();
  if (authError) return authError;

  try {
    const body = await req.json();

    // Validació bàsica
    if (!body.name || !body.isin || !body.manager) {
      return NextResponse.json(
        { error: 'name, isin i manager són obligatoris' },
        { status: 400 }
      );
    }

    if (body.ter < 0 || body.ter > 5) {
      return NextResponse.json(
        { error: 'TER ha de ser entre 0 i 5%' },
        { status: 400 }
      );
    }

    const newFund = createFund({
      ...body,
      active:    true,
      updatedAt: new Date().toISOString().split('T')[0],
    });

    return NextResponse.json(newFund, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error creant el fons' }, { status: 500 });
  }
}

// PUT — Actualitzar fons existent
export async function PUT(req: NextRequest) {
  const authError = await checkAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id és obligatori' }, { status: 400 });
    }

    const updated = updateFund(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Fons no trobat' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Error actualitzant el fons' }, { status: 500 });
  }
}

// DELETE — Eliminar fons
export async function DELETE(req: NextRequest) {
  const authError = await checkAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id és obligatori' }, { status: 400 });
  }

  const deleted = deleteFund(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Fons no trobat' }, { status: 404 });
  }

  return NextResponse.json({ success: true, deletedId: id });
}
